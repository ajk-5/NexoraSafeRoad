"""Emergency stations, and the nearest ones to an incident.

The AI decides which services an incident needs (ai_service); which station of each
service should respond is geography, not AI: the nearest one is suggested and the admin
can pick another. Stations are read from config.STATIONS_FILE, imported from
OpenStreetMap by `python -m backend.import_stations`."""
from __future__ import annotations

import heapq
import json
import logging
import math
from dataclasses import asdict, dataclass
from functools import cache
from pathlib import Path
from typing import Any, cast

from .. import config
from ..errors import BadRequest
from ..models import Alert, ServiceType

log = logging.getLogger("saferoad.backend")

SUGGESTIONS_PER_SERVICE = 3

# A rough driving time from the straight-line distance: roads in and around Paris are
# about 1.4 times longer than the straight line, and an emergency vehicle averages about
# 35 km/h in city traffic. Only an order of magnitude; there is no routing.
ROAD_FACTOR = 1.4
AVERAGE_SPEED_KMH = 35


@dataclass(frozen=True)
class Station:
    id: str  # "osm:n123": OpenStreetMap node, way or relation
    service: ServiceType
    name: str
    address: str | None
    latitude: float
    longitude: float

    def seen_from(self, latitude: float, longitude: float) -> Nearby:
        meters = distance_m(latitude, longitude, self.latitude, self.longitude)
        return Nearby(**asdict(self), distance_m=round(meters), eta_minutes=eta_minutes(meters))


@dataclass(frozen=True)
class Nearby(Station):
    """A station and how far it is from an incident."""

    distance_m: int  # straight line
    eta_minutes: int  # rough driving estimate


@dataclass(frozen=True)
class _Registry:
    by_id: dict[str, Station]
    by_service: dict[ServiceType, list[Station]]


def load() -> int:
    """Read the station file now rather than on the first request; returns the station count."""
    return len(_registry(config.STATIONS_FILE).by_id)


def nearest(service: ServiceType, latitude: float, longitude: float, limit: int = SUGGESTIONS_PER_SERVICE) -> list[Nearby]:
    """The `limit` stations of `service` closest to the point, nearest first."""
    stations = _registry(config.STATIONS_FILE).by_service.get(service, [])
    closest = heapq.nsmallest(limit, stations, key=lambda s: distance_m(latitude, longitude, s.latitude, s.longitude))
    return [s.seen_from(latitude, longitude) for s in closest]


def get(station_id: str, service: ServiceType) -> Station:
    station = _registry(config.STATIONS_FILE).by_id.get(station_id)
    if station is None or station.service != service:
        raise BadRequest("UNKNOWN_STATION", f"{station_id} is not a {service} station.")
    return station


def choose(service: ServiceType, latitude: float, longitude: float, station_id: str | None) -> Station | None:
    """The station the admin picked, otherwise the nearest one (None without station data)."""
    if station_id is not None:
        return get(station_id, service)
    found = nearest(service, latitude, longitude, limit=1)
    return found[0] if found else None


def sent_station(alert: Alert) -> Nearby | None:
    """The station an alert was sent to, as recorded on the alert."""
    if alert.station_id is None or alert.station_name is None:
        return None
    if alert.station_latitude is None or alert.station_longitude is None:
        return None
    station = Station(
        id=alert.station_id,
        service=alert.service_type,
        name=alert.station_name,
        address=alert.station_address,
        latitude=alert.station_latitude,
        longitude=alert.station_longitude,
    )
    return station.seen_from(alert.incident.latitude, alert.incident.longitude)


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle (haversine) distance in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((phi2 - phi1) / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def eta_minutes(meters: float) -> int:
    return max(1, math.ceil(meters * ROAD_FACTOR / 1000 / AVERAGE_SPEED_KMH * 60))


@cache  # keyed by path, so tests can point config.STATIONS_FILE at their own file
def _registry(path: Path) -> _Registry:
    data: dict[str, Any]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        log.warning("No station data at %s: alerts will not name a station. Run python -m backend.import_stations", path)
        data = {"stations": []}
    stations = [
        Station(
            id=s["id"],
            service=ServiceType(s["service"]),
            name=s["name"],
            address=s.get("address"),
            latitude=float(s["latitude"]),
            longitude=float(s["longitude"]),
        )
        for s in cast("list[dict[str, Any]]", data["stations"])
    ]
    by_service: dict[ServiceType, list[Station]] = {}
    for station in stations:
        by_service.setdefault(station.service, []).append(station)
    return _Registry(by_id={s.id: s for s in stations}, by_service=by_service)
