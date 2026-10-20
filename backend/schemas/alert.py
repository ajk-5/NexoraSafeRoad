from __future__ import annotations

from datetime import datetime
from typing import Literal

from ..models import AlertStatus, ServiceType, Severity
from . import Schema
from .station import StationOut


class AlertStatusUpdate(Schema):
    # SENT -> ACCEPTED goes through POST /alerts/{id}/accept.
    status: Literal[AlertStatus.EN_ROUTE, AlertStatus.ON_SCENE, AlertStatus.RESOLVED]


class AlertOut(Schema):
    id: int
    incident_id: int
    incident_reference: str
    service_type: ServiceType
    status: AlertStatus
    severity: Severity
    location: str | None
    latitude: float
    longitude: float
    vehicles: int
    possible_injuries: bool
    assigned_operator: str | None  # display name
    station: StationOut | None  # the station called; None when there was no station data
    sent_at: datetime
    accepted_at: datetime | None
    resolved_at: datetime | None
    can_accept: bool
    can_update: bool
