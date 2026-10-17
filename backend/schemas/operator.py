from __future__ import annotations

from datetime import datetime

from pydantic import Field

from ..models import OperatorStatus, Role
from . import Schema


class LoginRequest(Schema):
    role: Role
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


class OperatorOut(Schema):
    id: int
    username: str
    display_name: str
    role: Role
    status: OperatorStatus
    last_seen_at: datetime | None
    current_incident_id: int | None


class LoginResponse(Schema):
    token: str
    operator: OperatorOut
