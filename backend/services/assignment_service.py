"""Who handles what.

An admin reviews one incident at a time and a service operator handles one
intervention at a time. This module distributes waiting incidents to available
admins, locks them, and releases them again when the admin disappears.

Concurrency: rows are claimed with SELECT ... FOR UPDATE SKIP LOCKED and operator
status changes are conditional UPDATEs, so on PostgreSQL two transactions can never
hand the same incident to two admins (README sections 34 and 47). SQLite ignores
FOR UPDATE, which is fine for tests and single-process development.
"""
from __future__ import annotations

from collections.abc import Collection
from datetime import datetime, timedelta

from sqlalchemy import case, or_, select, update
from sqlalchemy.orm import Session

from .. import config
from ..database import utcnow
from ..models import (
    ACTIVE_ALERT_STATUSES,
    LOCKED_STATUSES,
    Alert,
    Incident,
    IncidentStatus,
    Operator,
    OperatorStatus,
    Role,
    Severity,
)

# Waiting incidents are served HIGH first, then MEDIUM, then LOW; oldest first within a level.
_SEVERITY_ORDER = case(
    (Incident.severity == Severity.HIGH, 0),
    (Incident.severity == Severity.MEDIUM, 1),
    else_=2,
)


def current_incident_id(db: Session, operator: Operator) -> int | None:
    """The incident this operator is working on, if any."""
    if operator.is_admin:
        stmt = select(Incident.id).where(
            Incident.assigned_admin_id == operator.id, Incident.status.in_(LOCKED_STATUSES)
        )
    else:
        stmt = select(Alert.incident_id).where(
            Alert.assigned_operator_id == operator.id, Alert.status.in_(ACTIVE_ALERT_STATUSES)
        )
    return db.scalar(stmt.limit(1))


def available_status(db: Session, operator: Operator) -> OperatorStatus:
    """The status of a connected, unpaused operator: BUSY if they still hold work."""
    return OperatorStatus.BUSY if current_incident_id(db, operator) else OperatorStatus.ACTIVE


def set_status(
    db: Session, operator: Operator, status: OperatorStatus, only_from: Collection[OperatorStatus]
) -> bool:
    """Atomically move `operator` to `status` if its current status is in `only_from`."""
    result = db.execute(
        update(Operator)
        .where(Operator.id == operator.id, Operator.status.in_(only_from))
        .values(status=status)
        .execution_options(synchronize_session="fetch")
    )
    return result.rowcount > 0


def free_operator(db: Session, operator: Operator) -> None:
    """Called when an operator finishes their work. A paused operator stays paused."""
    set_status(db, operator, OperatorStatus.ACTIVE, only_from=[OperatorStatus.BUSY])


def touch(incident: Incident, now: datetime) -> None:
    """Record activity on a locked incident so its lock does not time out."""
    incident.last_activity_at = now


def assign_waiting_incidents(db: Session, now: datetime | None = None) -> list[Incident]:
    """Give waiting incidents to ACTIVE admins until either runs out.

    Every ACTIVE admin is idle (an admin with an incident is BUSY), so the fairest
    choice is the admin who has waited longest since their last assignment.
    """
    now = now or utcnow()
    assigned = []
    while True:
        admin = db.scalars(
            select(Operator)
            .where(Operator.role == Role.ADMIN, Operator.status == OperatorStatus.ACTIVE)
            .order_by(Operator.last_assigned_at.asc().nulls_first(), Operator.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if admin is None:
            break
        incident = db.scalars(
            select(Incident)
            .where(Incident.status == IncidentStatus.WAITING_FOR_OPERATOR)
            .order_by(_SEVERITY_ORDER, Incident.detected_at, Incident.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if incident is None:
            break
        incident.status = IncidentStatus.ASSIGNED
        incident.assigned_admin = admin
        incident.locked_at = now
        touch(incident, now)
        admin.status = OperatorStatus.BUSY
        admin.last_assigned_at = now
        db.flush()
        assigned.append(incident)
    return assigned


def requeue(db: Session, incident: Incident) -> None:
    """Take a locked incident away from its admin and put it back in the waiting queue."""
    admin = incident.assigned_admin
    incident.status = IncidentStatus.WAITING_FOR_OPERATOR
    incident.assigned_admin = None
    incident.locked_at = None
    db.flush()
    if admin is not None:
        free_operator(db, admin)


def mark_absent_offline(db: Session, now: datetime) -> None:
    """Operators who stopped sending heartbeats are no longer available."""
    cutoff = now - timedelta(seconds=config.OFFLINE_TIMEOUT)
    db.execute(
        update(Operator)
        .where(
            Operator.status != OperatorStatus.OFFLINE,
            or_(Operator.last_seen_at.is_(None), Operator.last_seen_at < cutoff),
        )
        .values(status=OperatorStatus.OFFLINE)
        .execution_options(synchronize_session="fetch")
    )


def release_expired_locks(db: Session, now: datetime) -> list[Incident]:
    """Requeue incidents whose admin showed no activity for LOCK_TIMEOUT seconds.

    The owner's heartbeat counts as activity, so a lock only expires when the admin
    disappears, not while they are watching the video or paused.
    """
    cutoff = now - timedelta(seconds=config.LOCK_TIMEOUT)
    expired = db.scalars(
        select(Incident)
        .where(Incident.status.in_(LOCKED_STATUSES), Incident.last_activity_at < cutoff)
        .with_for_update(skip_locked=True)
    ).all()
    for incident in expired:
        requeue(db, incident)
    return list(expired)


def sweep(db: Session, now: datetime | None = None) -> None:
    """Periodic job: detect absent operators, free their incidents, reassign them."""
    now = now or utcnow()
    mark_absent_offline(db, now)
    release_expired_locks(db, now)
    assign_waiting_incidents(db, now)
