from __future__ import annotations

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UTCDateTime, enum_type, utcnow
from .enums import OperatorStatus, Role, ServiceType


class Operator(Base):
    __tablename__ = "operators"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))  # "Admin Operator 03"
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(enum_type(Role), index=True)
    status: Mapped[OperatorStatus] = mapped_column(enum_type(OperatorStatus), default=OperatorStatus.OFFLINE, index=True)
    # SHA-256 of the session token. One session per operator: logging in again replaces it.
    token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Used to spread incidents fairly: the admin who waited longest gets the next one.
    last_assigned_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def service(self) -> ServiceType | None:
        """The emergency service a service operator works for (None for admins)."""
        return None if self.is_admin else ServiceType(self.role.value)
