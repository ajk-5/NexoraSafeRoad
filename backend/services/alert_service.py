"""Alerts: one per service called to an incident, handled by one service operator.

A sent alert is visible to every operator of its service; the first ACTIVE one to
accept it takes the intervention and moves it through ALERT_FLOW."""
from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..errors import Conflict, NotFound
from ..models import ALERT_FLOW, Alert, AlertStatus, Incident, IncidentStatus, Operator, OperatorStatus
from .assignment_service import free_operator, set_status

_LOAD = (selectinload(Alert.incident), selectinload(Alert.assigned_operator))


def visible_to(db: Session, viewer: Operator, status: AlertStatus | None = None, limit: int = 100) -> Sequence[Alert]:
    stmt = select(Alert).options(*_LOAD).order_by(Alert.sent_at.desc(), Alert.id.desc()).limit(limit)
    if not viewer.is_admin:
        stmt = stmt.where(Alert.service_type == viewer.service)
    if status is not None:
        stmt = stmt.where(Alert.status == status)
    return db.scalars(stmt).all()


def get_visible(db: Session, viewer: Operator, alert_id: int, *, for_update: bool = False) -> Alert:
    stmt = select(Alert).options(*_LOAD).where(Alert.id == alert_id)
    if for_update:
        stmt = stmt.with_for_update(of=Alert).execution_options(populate_existing=True)
    alert = db.scalar(stmt)
    if alert is None or not (viewer.is_admin or alert.service_type == viewer.service):
        raise NotFound("ALERT_NOT_FOUND", f"Alert {alert_id} does not exist.")
    return alert


def accept(db: Session, alert_id: int, operator: Operator, now: datetime) -> Alert:
    alert = get_visible(db, operator, alert_id, for_update=True)
    if alert.status != AlertStatus.SENT:
        raise Conflict("ALERT_ALREADY_ACCEPTED", "Another operator already accepted this alert.")
    if not set_status(db, operator, OperatorStatus.BUSY, only_from=[OperatorStatus.ACTIVE]):
        raise Conflict("OPERATOR_NOT_AVAILABLE", "Finish your current intervention, or resume, before accepting a new one.")
    alert.status = AlertStatus.ACCEPTED
    alert.assigned_operator = operator
    alert.accepted_at = now
    if alert.incident.status == IncidentStatus.ALERT_SENT:
        alert.incident.status = IncidentStatus.IN_PROGRESS
    return alert


def advance(db: Session, alert_id: int, operator: Operator, status: AlertStatus, now: datetime) -> Alert:
    """Move an accepted intervention forward: EN_ROUTE, ON_SCENE, RESOLVED (steps may be skipped)."""
    alert = get_visible(db, operator, alert_id, for_update=True)
    if alert.assigned_operator_id != operator.id:
        raise Conflict("ALERT_ALREADY_ASSIGNED", "This intervention is handled by another operator.")
    if ALERT_FLOW.index(status) <= ALERT_FLOW.index(alert.status):
        raise Conflict("INVALID_STATUS_CHANGE", f"Cannot go from {alert.status} to {status}.")
    alert.status = status
    if status == AlertStatus.RESOLVED:
        alert.resolved_at = now
        db.flush()
        free_operator(db, operator)
        _resolve_incident_if_done(db, alert.incident_id, now)
    return alert


def _resolve_incident_if_done(db: Session, incident_id: int, now: datetime) -> None:
    # Lock the incident first so two services resolving at the same moment cannot
    # both miss each other's update and leave the incident open.
    incident = db.get_one(Incident, incident_id, with_for_update=True, populate_existing=True)
    unresolved = db.scalar(
        select(func.count()).where(Alert.incident_id == incident_id, Alert.status != AlertStatus.RESOLVED)
    )
    if unresolved == 0:
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = now
