"""Incident delivery. Alerts to emergency services are simulated for the MVP:
they are logged, and the incident is sent to the backend when one is configured."""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

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


def send_incident(incident: dict, clip_path: Path, backend_url: str, api_key: str) -> bool:
    """Report the incident to the backend, then upload its clip for the operator to review."""
    url = f"{backend_url.rstrip('/')}/api/incidents"
    created = _request("POST", url, json.dumps(incident).encode(), "application/json", api_key)
    if created is None:
        return False
    return _request("PUT", f"{url}/{created['id']}/video", clip_path.read_bytes(), "video/mp4", api_key) is not None


def _request(method: str, url: str, body: bytes, content_type: str, api_key: str) -> dict | None:
    request = urllib.request.Request(
        url, data=body, method=method, headers={"Content-Type": content_type, "X-API-Key": api_key}
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        log.error("%s %s failed with %s: %s", method, url, exc.code, exc.read().decode(errors="replace"))
    except (urllib.error.URLError, TimeoutError) as exc:
        log.error("%s %s failed: %s", method, url, exc)
    return None
