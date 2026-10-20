"""Nexora SafeRoad API.

Run from the repository root:
    uvicorn backend.main:app --reload
Interactive docs: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .database import Base, SessionLocal, add_missing_columns, engine, utcnow
from .errors import ServiceError
from .routes import alerts, auth, incidents, operators, statistics, training
from .seed import seed_demo_operators, seed_model_registry
from .services import assignment_service, station_service, training_service

log = logging.getLogger("saferoad.backend")


def sweep_once() -> None:
    with SessionLocal() as db:
        now = utcnow()
        assignment_service.sweep(db, now)
        training_service.fail_stalled_jobs(db, now)
        db.commit()


async def sweep_forever() -> None:
    """Every SWEEP_INTERVAL seconds: mark silent operators OFFLINE, free their
    incidents, give waiting incidents to available admins, and fail training jobs
    whose worker stopped responding."""
    while True:
        await asyncio.sleep(config.SWEEP_INTERVAL)
        try:
            await asyncio.to_thread(sweep_once)
        except Exception:
            log.exception("Timeout sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No migrations yet: tables are created on startup. Add Alembic once the schema settles.
    Base.metadata.create_all(engine)
    add_missing_columns(engine)
    station_service.load()
    config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    training_service.uploads_dir().mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        seed_model_registry(db)
        if config.SEED_DEMO_OPERATORS:
            seed_demo_operators(db)
    sweeper = asyncio.create_task(sweep_forever()) if config.SWEEP_INTERVAL > 0 else None
    yield
    if sweeper:
        sweeper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweeper


app = FastAPI(title="Nexora SafeRoad API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ServiceError)
async def service_error(request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse({"error": exc.error, "message": exc.message}, status_code=exc.status_code)


for module in (auth, operators, incidents, alerts, statistics, training):
    app.include_router(module.router, prefix="/api")

app.mount("/media", StaticFiles(directory=config.MEDIA_DIR, check_dir=False), name="media")


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
