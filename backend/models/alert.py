from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UTCDateTime, enum_type, utcnow
from .enums import AlertStatus, ServiceType

if TYPE_CHECKING:
    from .incident import Incident
    from .operator import Operator


class Alert(Base):
    """One emergency service called to one incident."""

    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("incident_id", "service_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    service_type: Mapped[ServiceType] = mapped_column(enum_type(ServiceType), index=True)
    status: Mapped[AlertStatus] = mapped_column(enum_type(AlertStatus), default=AlertStatus.SENT, index=True)
    # The service operator who accepted the intervention.
    assigned_operator_id: Mapped[int | None] = mapped_column(ForeignKey("operators.id"), index=True)
    sent_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    incident: Mapped[Incident] = relationship(back_populates="alerts")
    assigned_operator: Mapped[Operator | None] = relationship()
