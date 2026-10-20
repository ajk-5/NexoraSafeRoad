from __future__ import annotations

from datetime import datetime

from pydantic import AwareDatetime, Field

from ..models import AlertStatus, IncidentStatus, ServiceType, Severity
from . import Schema
from .station import StationOut


class IncidentCreate(Schema):
    """An incident report from the AI pipeline (`build_incident` in ai/main.py): what it saw.
    The services to alert are decided from this (services/ai_service.py). Extra fields it
    sends (type, video_time, clip_path, and `responders` from older versions) are ignored."""

    camera_id: str = Field(min_length=1, max_length=64)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location: str | None = Field(default=None, max_length=200)
    severity: Severity
    confidence: float = Field(ge=0, le=1)
    vehicles: int = Field(ge=0)
    people: int = Field(ge=0)
    fire: bool = False
    overturned: bool = False
    detected_at: AwareDatetime | None = None


class ServiceSelection(Schema):
    services: list[ServiceType]
    # The station picked for a service (GET /incidents/{id}/stations); a selected service
    # left out here gets its nearest station.
    stations: dict[ServiceType, str] = {}


class SendAlertRequest(ServiceSelection):
    services: list[ServiceType] = Field(min_length=1)


class SuggestedService(Schema):
    service: ServiceType
    reason: str


class IncidentAlert(Schema):
    id: int
    service_type: ServiceType
    status: AlertStatus
    assigned_operator: str | None  # display name
    station: StationOut | None  # who was called; None when there was no station data
    sent_at: datetime
    accepted_at: datetime | None
    resolved_at: datetime | None


class IncidentOut(Schema):
    id: int
    reference: str  # "INC-1001"
    camera_id: str
    latitude: float
    longitude: float
    location: str | None
    severity: Severity
    confidence: float
    vehicles: int
    people: int
    possible_injuries: bool
    fire: bool
    overturned: bool
    video_url: str | None
    status: IncidentStatus
    detected_at: datetime
    decided_at: datetime | None
    resolved_at: datetime | None
    assigned_admin: str | None  # display name of the admin reviewing (or who reviewed) it
    can_edit: bool  # false means read-only for this viewer
    suggested_services: list[SuggestedService]
    selected_services: list[ServiceType]
    selected_stations: dict[ServiceType, str]  # the admin's station choices so far
    alerts: list[IncidentAlert]
