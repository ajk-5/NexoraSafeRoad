"""Authenticated change notifications, backed by fresh database reads across workers."""
from __future__ import annotations

import asyncio
import hashlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import config
from ..database import SessionLocal
from ..services import alert_service, incident_service, operator_service
from .alerts import alert_out
from .incidents import incident_out
from .operators import operator_out

router = APIRouter(tags=["live"])
CHECK_INTERVAL = 1.0


def fingerprint(token: str) -> str | None:
    # Never keep a transaction open for the lifetime of a socket. Using the database
    # also observes AI reports, sweeps and changes handled by other API workers.
    with SessionLocal() as db:
        viewer = operator_service.find_by_token(db, token)
        if viewer is None:
            return None
        account = operator_out(db, viewer).model_dump_json(exclude={"last_seen_at"})
        incidents = [incident_out(i, viewer).model_dump_json() for i in incident_service.visible_to(db, viewer)]
        alerts = [alert_out(a, viewer).model_dump_json() for a in alert_service.visible_to(db, viewer)] if viewer.service else []
        return hashlib.sha256(repr((account, incidents, alerts)).encode()).hexdigest()


@router.websocket("/live")
async def live(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if origin and origin not in config.CORS_ORIGINS and "*" not in config.CORS_ORIGINS:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        # Credentials travel in a frame, never in URLs or proxy access logs.
        message = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = message.get("token") if isinstance(message, dict) else None
        if not isinstance(token, str) or not token or len(token) > 512:
            await websocket.close(code=1008)
            return
        previous = None
        while True:
            current = await asyncio.to_thread(fingerprint, token)
            if current is None:  # logout or a replacement session revokes the socket
                await websocket.close(code=1008)
                return
            await websocket.send_json({"type": "changed" if current != previous else "ping"})
            previous = current
            # Receive while waiting so disconnected clients release resources promptly.
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=CHECK_INTERVAL)
            except TimeoutError:
                continue
            # The protocol has no client messages after authentication.
            await websocket.close(code=1008)
            return
    except (WebSocketDisconnect, TimeoutError, ValueError):
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=1008)
