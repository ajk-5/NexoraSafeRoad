"""Incidents: created by the AI, reviewed by the admin who holds the lock."""
from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import config
from ..errors import Conflict, NotFound
from ..models import LOCKED_STATUSES, Alert, Incident, IncidentStatus, Operator, ServiceType
from ..schemas.incident import IncidentCreate
from .assignment_service import assign_waiting_incidents, free_operator, touch

_LOAD = (
    selectinload(Incident.assigned_admin),
    selectinload(Incident.alerts).selectinload(Alert.assigned_operator),
)


def create(db: Session, report: IncidentCreate, now: datetime) -> Incident:
    """Store an incident reported by the AI and hand it to an available admin."""
    services = [s.value for s in _unique(report.responders)]
    incident = Incident(
        camera_id=report.camera_id,
        latitude=report.latitude,
        longitude=report.longitude,
        location=report.location,
        severity=report.severity,
        confidence=report.confidence,
        vehicles=report.vehicles,
        people=report.people,
        fire=report.fire,
        overturned=report.overturned,
        detected_at=report.detected_at or now,
        suggested_services=services,
        selected_services=services,
        status=IncidentStatus.WAITING_FOR_OPERATOR,
    )
    db.add(incident)
    db.flush()
    assign_waiting_incidents(db, now)
    return incident


def attach_video(db: Session, incident_id: int, video: bytes) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise _not_found(incident_id)
    config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    path = config.MEDIA_DIR / f"{incident.reference}.mp4"
    path.write_bytes(video)
    incident.video_url = f"/media/{path.name}"
    return incident


def visible_to(db: Session, viewer: Operator, status: IncidentStatus | None = None, limit: int = 100) -> Sequence[Incident]:
    """Admins see every incident; a service operator only those their service was alerted to."""
    stmt = select(Incident).options(*_LOAD).order_by(Incident.detected_at.desc(), Incident.id.desc()).limit(limit)
    if not viewer.is_admin:
        stmt = stmt.where(Incident.alerts.any(Alert.service_type == viewer.service))
    if status is not None:
        stmt = stmt.where(Incident.status == status)
    return db.scalars(stmt).all()


def get_visible(db: Session, viewer: Operator, incident_id: int) -> Incident:
    incident = db.scalar(select(Incident).options(*_LOAD).where(Incident.id == incident_id))
    if incident is None or not (viewer.is_admin or any(a.service_type == viewer.service for a in incident.alerts)):
        raise _not_found(incident_id)
    return incident


def can_edit(incident: Incident, viewer: Operator) -> bool:
    return incident.status in LOCKED_STATUSES and incident.assigned_admin_id == viewer.id


def start_review(db: Session, incident_id: int, admin: Operator, now: datetime) -> Incident:
    """The admin opened the incident."""
    incident = _lock_for(db, incident_id, admin)
    incident.status = IncidentStatus.UNDER_REVIEW
    touch(incident, now)
    return incident


def save_draft(db: Session, incident_id: int, admin: Operator, services: list[ServiceType], now: datetime) -> Incident:
    incident = _lock_for(db, incident_id, admin)
    incident.selected_services = [s.value for s in _unique(services)]
    incident.status = IncidentStatus.UNDER_REVIEW
    touch(incident, now)
    return incident


def send_alert(db: Session, incident_id: int, admin: Operator, services: list[ServiceType], now: datetime) -> Incident:
    """Alert the selected services. This ends the admin's review."""
    incident = _lock_for(db, incident_id, admin)
    services = _unique(services)
    incident.selected_services = [s.value for s in services]
    db.add_all(Alert(incident=incident, service_type=s, sent_at=now) for s in services)
    _close_review(db, incident, admin, IncidentStatus.ALERT_SENT, now)
    return incident


def decline(db: Session, incident_id: int, admin: Operator, now: datetime) -> Incident:
    """False positive, or no intervention needed."""
    incident = _lock_for(db, incident_id, admin)
    _close_review(db, incident, admin, IncidentStatus.DECLINED, now)
    return incident


def _lock_for(db: Session, incident_id: int, admin: Operator) -> Incident:
    """Load an incident for modification, checking that `admin` holds its lock."""
    incident = db.scalar(
        select(Incident)
        .where(Incident.id == incident_id)
        .with_for_update()
        .execution_options(populate_existing=True)  # use the row as locked, not a cached copy
    )
    if incident is None:
        raise _not_found(incident_id)
    if incident.status not in LOCKED_STATUSES:
        raise Conflict("INCIDENT_NOT_UNDER_REVIEW", f"{incident.reference} is {incident.status} and can no longer be changed.")
    if incident.assigned_admin_id != admin.id:
        raise Conflict("INCIDENT_ALREADY_ASSIGNED", "This incident is currently handled by another operator.")
    return incident


def _close_review(db: Session, incident: Incident, admin: Operator, status: IncidentStatus, now: datetime) -> None:
    incident.status = status
    incident.decided_at = now
    incident.locked_at = None
    db.flush()
    free_operator(db, admin)
    assign_waiting_incidents(db, now)


def _unique(services: list[ServiceType]) -> list[ServiceType]:
    return list(dict.fromkeys(services))


def _not_found(incident_id: int) -> NotFound:
    return NotFound("INCIDENT_NOT_FOUND", f"Incident {incident_id} does not exist.")
