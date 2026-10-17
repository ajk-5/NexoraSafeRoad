"""Operator sessions and availability: login, logout, pause, resume, heartbeat."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .. import security
from ..errors import Conflict, Unauthorized
from ..models import LOCKED_STATUSES, Incident, Operator, OperatorStatus, Role
from .assignment_service import assign_waiting_incidents, available_status, requeue, set_status


def find_by_token(db: Session, token: str) -> Operator | None:
    return db.scalar(select(Operator).where(Operator.token_hash == security.hash_token(token)))


def login(db: Session, role: Role, username: str, password: str, now: datetime) -> tuple[Operator, str]:
    """Check credentials and open a session. Returns the operator and their new token."""
    operator = db.scalar(select(Operator).where(Operator.username == username))
    if operator is None or operator.role != role or not security.verify_password(password, operator.password_hash):
        raise Unauthorized("INVALID_CREDENTIALS", "Wrong username, password or role.")
    token = security.new_token()
    operator.token_hash = security.hash_token(token)
    operator.last_seen_at = now
    _come_online(db, operator, now)
    return operator, token


def logout(db: Session, operator: Operator) -> None:
    if operator.is_admin:
        # Hand the incident under review to another admin right away instead of
        # waiting for the lock to time out.
        held = db.scalars(
            select(Incident)
            .where(Incident.assigned_admin_id == operator.id, Incident.status.in_(LOCKED_STATUSES))
            .with_for_update()
        ).all()
        for incident in held:
            requeue(db, incident)
    operator.token_hash = None
    operator.status = OperatorStatus.OFFLINE
    db.flush()
    if operator.is_admin:
        assign_waiting_incidents(db)


def pause(db: Session, operator: Operator) -> None:
    """Stop receiving new work. Work already in hand stays with the operator."""
    if not set_status(db, operator, OperatorStatus.PAUSED, only_from=[OperatorStatus.ACTIVE, OperatorStatus.BUSY]):
        raise Conflict("CANNOT_PAUSE", f"Cannot pause while {operator.status}.")


def resume(db: Session, operator: Operator, now: datetime) -> None:
    if not set_status(db, operator, available_status(db, operator), only_from=[OperatorStatus.PAUSED]):
        raise Conflict("NOT_PAUSED", f"Cannot resume while {operator.status}.")
    if operator.is_admin:
        assign_waiting_incidents(db, now)


def heartbeat(db: Session, operator: Operator, now: datetime) -> None:
    """The frontend calls this every 30 s to show the operator is still there."""
    operator.last_seen_at = now
    if operator.is_admin:
        # The heartbeat also keeps the lock on the incident under review alive.
        db.execute(
            update(Incident)
            .where(Incident.assigned_admin_id == operator.id, Incident.status.in_(LOCKED_STATUSES))
            .values(last_activity_at=now)
        )
    # An operator marked OFFLINE after a network drop comes back online.
    _come_online(db, operator, now)


def _come_online(db: Session, operator: Operator, now: datetime) -> None:
    if set_status(db, operator, available_status(db, operator), only_from=[OperatorStatus.OFFLINE]):
        if operator.is_admin:
            assign_waiting_incidents(db, now)
