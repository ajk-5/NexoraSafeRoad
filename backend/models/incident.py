from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UTCDateTime, enum_type, utcnow
from .enums import IncidentStatus, Severity

if TYPE_CHECKING:
    from .alert import Alert
    from .operator import Operator


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(64))
    latitude: Mapped[float]
    longitude: Mapped[float]
    location: Mapped[str | None] = mapped_column(String(200))  # human label, e.g. "A7 - KM 32.4"

    # What the AI saw.
    severity: Mapped[Severity] = mapped_column(enum_type(Severity))
    confidence: Mapped[float]
    vehicles: Mapped[int]
    people: Mapped[int]
    fire: Mapped[bool] = mapped_column(default=False)
    overturned: Mapped[bool] = mapped_column(default=False)
    video_url: Mapped[str | None] = mapped_column(String(500))
    detected_at: Mapped[datetime] = mapped_column(UTCDateTime)

    # Services as ServiceType values: what the AI recommends, and the admin's current choice
    # (starts as the recommendation, changed by "Save draft", final once the alert is sent).
    suggested_services: Mapped[list[str]] = mapped_column(JSON, default=list)
    selected_services: Mapped[list[str]] = mapped_column(JSON, default=list)

    status: Mapped[IncidentStatus] = mapped_column(enum_type(IncidentStatus), index=True)
    # Locked to this admin while status is ASSIGNED or UNDER_REVIEW; afterwards it records who decided.
    assigned_admin_id: Mapped[int | None] = mapped_column(ForeignKey("operators.id"), index=True)
    locked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    last_activity_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    assigned_admin: Mapped[Operator | None] = relationship()
    alerts: Mapped[list[Alert]] = relationship(back_populates="incident", order_by="Alert.id")

    @property
    def reference(self) -> str:
        return f"INC-{1000 + self.id}"

    @property
    def possible_injuries(self) -> bool:
        return self.people > 0 or self.fire or self.overturned
