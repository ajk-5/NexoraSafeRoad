"""Incident delivery: the incident is logged, and sent to the backend when one is
configured. The backend decides which services to alert, and the admin confirms."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import NotRequired, TypedDict

from .backend_client import BackendClient, BackendError

log = logging.getLogger("saferoad.ai")


class IncidentReport(TypedDict):
    """What the AI saw for a confirmed accident (the backend's IncidentCreate)."""

    type: str
    camera_id: str
    latitude: float
    longitude: float
    severity: str
    confidence: float
    vehicles: int
    people: int
    fire: bool
    overturned: bool
    detected_at: str
    video_time: float
    clip_path: NotRequired[str]  # set once the clip is written


def log_incident(incident: IncidentReport) -> None:
    seen = f"{incident['vehicles']} vehicles, {incident['people']} people"
    if incident["fire"]:
        seen += ", fire"
    if incident["overturned"]:
        seen += ", overturned vehicle"
    log.warning(
        "ACCIDENT [%s] %s | %.5f, %.5f | clip: %s",
        incident["severity"],
        seen,
        incident["latitude"],
        incident["longitude"],
        incident.get("clip_path"),
    )


def send_incident(incident: IncidentReport, clip_path: Path, backend_url: str, api_key: str) -> bool:
    """Report the incident to the backend, then upload its clip for the operator to review."""
    client = BackendClient(backend_url, api_key)
    try:
        created = client.post("/api/incidents", incident)
        client.put_file(f"/api/incidents/{created['id']}/video", clip_path, "video/mp4")
    except BackendError as exc:
        log.error("Could not send the incident to the backend: %s", exc)
        return False
    return True
