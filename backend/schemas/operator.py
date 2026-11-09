from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from ..models import OperatorStatus, Role
from ..password_policy import validate_new_password
from . import Schema


class LoginRequest(Schema):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class PasswordChange(Schema):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str

    _password_policy = field_validator("new_password")(validate_new_password)


class OperatorCreate(Schema):
    """A new account, created by the super admin."""

    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    display_name: str = Field(min_length=1, max_length=100)
    role: Role
    password: str

    _password_policy = field_validator("password")(validate_new_password)


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
