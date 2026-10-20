from __future__ import annotations

from datetime import datetime

from pydantic import AwareDatetime, Field, field_validator

from ..models import AlertStatus, IncidentStatus, ServiceType, Severity
from . import Schema


class IncidentCreate(Schema):
    """An incident report from the AI pipeline (`build_incident` in ai/main.py).
    Extra fields it sends (type, video_time, clip_path...) are ignored."""

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
    responders: list[ServiceType] = []  # the AI's suggested services
    detected_at: AwareDatetime | None = None

    @field_validator("responders", mode="before")
    @classmethod
    def _uppercase(cls, value):
        # The AI uses lower-case service names ("police", "depannage").
        return [s.upper() if isinstance(s, str) else s for s in value] if isinstance(value, list) else value


class ServiceSelection(Schema):
    services: list[ServiceType]


class SendAlertRequest(Schema):
    services: list[ServiceType] = Field(min_length=1)


class SuggestedService(Schema):
    service: ServiceType
    reason: str


class IncidentAlert(Schema):
    id: int
    service_type: ServiceType
    status: AlertStatus
    assigned_operator: str | None  # display name
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
    alerts: list[IncidentAlert]
