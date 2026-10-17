"""Figures for the admin Statistics page and dashboard."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Alert, Incident, IncidentStatus, Operator, OperatorStatus, ServiceType, Severity


def _count_by(db: Session, column) -> dict:
    return dict(db.execute(select(column, func.count()).group_by(column)).all())


def compute(db: Session, now: datetime, days: int = 7) -> dict:
    by_status = _count_by(db, Incident.status)
    by_severity = _count_by(db, Incident.severity)
    by_service = _count_by(db, Alert.service_type)
    operators = _count_by(db, Operator.status)

    first_day = (now - timedelta(days=days - 1)).date()
    since = datetime.combine(first_day, datetime.min.time(), tzinfo=now.tzinfo)
    per_day = Counter(d.date() for d in db.scalars(select(Incident.detected_at).where(Incident.detected_at >= since)))

    # Response time: from the alert being sent to a service operator accepting it.
    response_times = [
        (accepted - sent).total_seconds()
        for sent, accepted in db.execute(select(Alert.sent_at, Alert.accepted_at).where(Alert.accepted_at.is_not(None)))
    ]

    return {
        "total_incidents": sum(by_status.values()),
        "resolved_incidents": by_status.get(IncidentStatus.RESOLVED, 0),
        "incidents_by_status": {s: by_status.get(s, 0) for s in IncidentStatus},
        "incidents_by_severity": {s: by_severity.get(s, 0) for s in Severity},
        "incidents_by_camera": _count_by(db, Incident.camera_id),
        "incidents_per_day": [
            {"date": day, "count": per_day.get(day, 0)} for day in (first_day + timedelta(days=i) for i in range(days))
        ],
        "alerts_by_service": {s: by_service.get(s, 0) for s in ServiceType},
        "average_response_seconds": sum(response_times) / len(response_times) if response_times else None,
        "operators_by_status": {s: operators.get(s, 0) for s in OperatorStatus},
    }
