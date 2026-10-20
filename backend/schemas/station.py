from __future__ import annotations

from ..models import ServiceType
from . import Schema


class StationOut(Schema):
    """An emergency station and how far it is from the incident (services/station_service.py)."""

    id: str
    name: str
    address: str | None
    latitude: float
    longitude: float
    distance_m: int  # straight line
    eta_minutes: int  # rough driving estimate, no routing


class ServiceStations(Schema):
    service: ServiceType
    stations: list[StationOut]  # nearest first
