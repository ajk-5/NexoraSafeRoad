from __future__ import annotations

import datetime as dt

from ..models import IncidentStatus, OperatorStatus, ServiceType, Severity
from . import Schema


class DayCount(Schema):
    date: dt.date
    count: int


class StatisticsOut(Schema):
    total_incidents: int
    resolved_incidents: int
    incidents_by_status: dict[IncidentStatus, int]
    incidents_by_severity: dict[Severity, int]
    incidents_by_camera: dict[str, int]
    incidents_per_day: list[DayCount]
    alerts_by_service: dict[ServiceType, int]
    average_response_seconds: float | None  # alert sent -> accepted by a service operator
    operators_by_status: dict[OperatorStatus, int]
