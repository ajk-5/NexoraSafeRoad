"""Incident delivery. Alerts to emergency services are simulated for the MVP:
they are logged, and the incident is POSTed to the backend when one is configured."""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

log = logging.getLogger("saferoad.ai")


def simulate_dispatch(incident: dict) -> None:
    log.warning(
        "ALERT [%s] -> %s | %.5f, %.5f | clip: %s",
        incident["severity"],
        ", ".join(incident["responders"]),
        incident["latitude"],
        incident["longitude"],
        incident.get("clip_path"),
    )


def send_incident(incident: dict, backend_url: str) -> bool:
    request = urllib.request.Request(
        f"{backend_url.rstrip('/')}/incidents",
        data=json.dumps(incident).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, TimeoutError) as exc:
        log.error("Could not send incident to %s: %s", backend_url, exc)
        return False
