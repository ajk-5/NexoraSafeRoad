"""AI training platform: the model registry, training jobs and the workers that run them.

Training itself happens on a GPU machine running `python -m ai.trainer`: it claims queued
jobs, reports progress after every epoch and uploads the trained weights. A trained model
is only used by the detector once an admin activates it (README: the human decides).
"""
from __future__ import annotations

import hashlib
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from .. import config
from ..errors import BadRequest, Conflict, NotFound
from ..models import (
    AIModel,
    Incident,
    IncidentStatus,
    ModelSource,
    Operator,
    TrainingJob,
    TrainingStatus,
    TrainingWorker,
)
from ..schemas.training import JobEnd, ProgressReport, TrainingJobCreate
from . import dataset_service

# Class names the detector reacts to (ACCIDENT_LABELS etc. in ai/detector.py).
ACCIDENT_CLASSES = frozenset({"accident", "crash", "collision"})
DETECTOR_CLASSES = ACCIDENT_CLASSES | {"fire", "overturned", "rollover"}
CONFIRMED_STATUSES = (IncidentStatus.ALERT_SENT, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED)
LOG_LINES_KEPT = 400


def models_dir() -> Path:
    return config.TRAINING_DIR / "models"


def uploads_dir() -> Path:
    return config.TRAINING_DIR / "uploads"


def detector_classes(class_names: Sequence[str]) -> list[str]:
    return [name for name in class_names if name.lower() in DETECTOR_CLASSES]


def has_accident_class(class_names: Sequence[str]) -> bool:
    return any(name.lower() in ACCIDENT_CLASSES for name in class_names)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


# ---------- Models ----------


def list_models(db: Session) -> Sequence[AIModel]:
    return db.scalars(select(AIModel).order_by(AIModel.created_at.desc(), AIModel.id.desc())).all()


def get_model(db: Session, model_id: int) -> AIModel:
    model = db.get(AIModel, model_id)
    if model is None:
        raise NotFound("MODEL_NOT_FOUND", f"Model {model_id} does not exist.")
    return model


def active_model(db: Session) -> AIModel | None:
    return db.scalar(select(AIModel).where(AIModel.is_active.is_(True)).limit(1))


def activate_model(db: Session, model_id: int) -> AIModel:
    """Make this the model the detector uses."""
    model = get_model(db, model_id)
    if not has_accident_class(model.class_names):
        raise Conflict("MODEL_CANNOT_DETECT_ACCIDENTS", "This model has no accident class, the detector would never report anything.")
    db.execute(update(AIModel).where(AIModel.id != model.id).values(is_active=False))
    model.is_active = True
    return model


def model_file(model: AIModel) -> Path:
    if model.file_name is None:
        raise NotFound("MODEL_FILE_NOT_STORED", "This model's weights are downloaded by the AI side (ai/download_models.py).")
    return models_dir() / model.file_name


def model_download_path(model: AIModel) -> str | None:
    return f"/api/training/worker/models/{model.id}/file" if model.file_name else None


# ---------- Jobs ----------


def create_job(db: Session, request: TrainingJobCreate, admin: Operator) -> TrainingJob:
    dataset = dataset_service.get_dataset(db, request.dataset_id)
    if request.base_model_id is not None:
        get_model(db, request.base_model_id)
    if request.use_confirmed and not has_accident_class(dataset.class_names):
        raise BadRequest("NO_ACCIDENT_CLASS", "Confirmed incidents can only be added to a dataset that has an accident class.")
    job = TrainingJob(
        dataset=dataset,
        base_model_id=request.base_model_id,
        base_checkpoint=request.base_checkpoint,
        epochs=request.epochs,
        image_size=request.image_size,
        batch=request.batch,
        use_false_alarms=request.use_false_alarms,
        use_confirmed=request.use_confirmed,
        created_by_id=admin.id,
    )
    db.add(job)
    db.flush()
    return job


def base_name(job: TrainingJob) -> str:
    return job.base_model.name if job.base_model else (job.base_checkpoint or "?")


_JOB_LOAD = (selectinload(TrainingJob.dataset), selectinload(TrainingJob.base_model))


def list_jobs(db: Session, limit: int = 50) -> Sequence[TrainingJob]:
    stmt = select(TrainingJob).options(*_JOB_LOAD).order_by(TrainingJob.created_at.desc(), TrainingJob.id.desc())
    return db.scalars(stmt.limit(limit)).all()


def get_job(db: Session, job_id: int) -> TrainingJob:
    job = db.scalar(select(TrainingJob).options(*_JOB_LOAD).where(TrainingJob.id == job_id))
    if job is None:
        raise NotFound("JOB_NOT_FOUND", f"Training job {job_id} does not exist.")
    return job


def cancel_job(db: Session, job_id: int, now: datetime) -> TrainingJob:
    """A queued job is cancelled at once; a running one stops after its current epoch."""
    job = _locked_job(db, job_id)
    if job.status == TrainingStatus.QUEUED:
        job.status = TrainingStatus.CANCELLED
        job.finished_at = now
    elif job.status == TrainingStatus.RUNNING:
        job.cancel_requested = True
    else:
        raise Conflict("JOB_FINISHED", f"This job is already {job.status.lower()}.")
    return job


def _locked_job(db: Session, job_id: int) -> TrainingJob:
    job = db.get(TrainingJob, job_id, with_for_update=True, populate_existing=True)
    if job is None:
        raise NotFound("JOB_NOT_FOUND", f"Training job {job_id} does not exist.")
    return job


def count_jobs(db: Session, status: TrainingStatus) -> int:
    return db.scalar(select(func.count()).select_from(TrainingJob).where(TrainingJob.status == status)) or 0


# ---------- Operator feedback ----------


@dataclass(frozen=True)
class Clip:
    incident_id: int
    label: Literal["false_alarm", "accident"]
    video_url: str


def feedback_counts(db: Session) -> tuple[int, int]:
    """(false alarms, confirmed accidents) among reviewed incidents that have a clip."""
    def count(*statuses: IncidentStatus) -> int:
        stmt = select(func.count()).select_from(Incident).where(
            Incident.status.in_(statuses), Incident.video_url.is_not(None)
        )
        return db.scalar(stmt) or 0

    return count(IncidentStatus.DECLINED), count(*CONFIRMED_STATUSES)


def feedback_clips(db: Session, false_alarms: bool, confirmed: bool) -> list[Clip]:
    statuses = ([IncidentStatus.DECLINED] if false_alarms else []) + (list(CONFIRMED_STATUSES) if confirmed else [])
    incidents = db.scalars(
        select(Incident).where(Incident.status.in_(statuses), Incident.video_url.is_not(None)).order_by(Incident.id)
    ).all()
    return [
        Clip(i.id, "false_alarm" if i.status == IncidentStatus.DECLINED else "accident", i.video_url or "")
        for i in incidents
    ]


# ---------- Training worker ----------


def latest_worker(db: Session) -> TrainingWorker | None:
    return db.scalar(select(TrainingWorker).order_by(TrainingWorker.last_seen_at.desc()).limit(1))


def is_online(worker: TrainingWorker, now: datetime) -> bool:
    return worker.last_seen_at >= now - timedelta(seconds=config.WORKER_TIMEOUT)


def heartbeat(db: Session, name: str, device: str, now: datetime) -> None:
    worker = db.get(TrainingWorker, name)
    if worker is None:
        db.add(TrainingWorker(name=name, device=device, last_seen_at=now))
    else:
        worker.device = device
        worker.last_seen_at = now


def claim_job(db: Session, worker_name: str, now: datetime) -> TrainingJob | None:
    """Give the oldest queued job to this worker (never to two workers)."""
    job = db.scalars(
        select(TrainingJob)
        .where(TrainingJob.status == TrainingStatus.QUEUED)
        .order_by(TrainingJob.created_at, TrainingJob.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    ).first()
    if job is not None:
        job.status = TrainingStatus.RUNNING
        job.worker_name = worker_name
        job.started_at = now
    return job


def _running_job(db: Session, job_id: int, worker_name: str) -> TrainingJob:
    job = _locked_job(db, job_id)
    if job.status != TrainingStatus.RUNNING or job.worker_name != worker_name:
        raise Conflict("JOB_NOT_RUNNING_HERE", f"Training job {job_id} is not running on {worker_name}.")
    return job


def record_progress(db: Session, job_id: int, report: ProgressReport) -> bool:
    """Store an epoch's metrics. Returns True if the admin asked to cancel."""
    job = _running_job(db, job_id, report.name)
    metrics: dict[str, Any] = report.metrics.model_dump()
    if report.final:
        job.final_metrics = metrics
    else:
        others = [entry for entry in job.history if entry.get("epoch") != metrics["epoch"]]
        job.history = sorted([*others, metrics], key=lambda entry: int(entry.get("epoch", 0)))
        job.current_epoch = report.metrics.epoch
    _append_log(job, report.log_lines)
    return job.cancel_requested


def end_job(db: Session, job_id: int, end: JobEnd, now: datetime) -> TrainingJob:
    """The worker gave up (error) or stopped on request (cancelled)."""
    job = _running_job(db, job_id, end.name)
    job.status = end.status
    job.error = end.error
    job.finished_at = now
    _append_log(job, end.log_lines)
    return job


def complete_job(db: Session, job_id: int, worker_name: str, upload: Path, size_bytes: int, now: datetime) -> AIModel:
    """Register the uploaded weights as a new model. Admins activate it themselves."""
    try:
        job = _running_job(db, job_id, worker_name)
    except Conflict:
        upload.unlink(missing_ok=True)
        raise
    metrics = job.final_metrics or (job.history[-1] if job.history else {})
    model = AIModel(
        name=f"Job #{job.id} · {job.dataset.name}",
        source=ModelSource.TRAINED,
        file_name="",
        sha256=sha256_of(upload),
        size_bytes=size_bytes,
        class_names=list(job.dataset.class_names),
        map50=metrics.get("map50"),
        map50_95=metrics.get("map50_95"),
        precision=metrics.get("precision"),
        recall=metrics.get("recall"),
        metrics_note=f"Measured on the validation images of {job.dataset.name} ({job.current_epoch} epochs)",
    )
    db.add(model)
    db.flush()
    model.file_name = f"model-{model.id}.pt"
    models_dir().mkdir(parents=True, exist_ok=True)
    shutil.move(upload, model_file(model))
    job.status = TrainingStatus.COMPLETED
    job.result_model = model
    job.finished_at = now
    return model


def fail_stalled_jobs(db: Session, now: datetime) -> None:
    """Running jobs whose worker went silent (crashed, switched off) are marked failed."""
    cutoff = now - timedelta(seconds=config.WORKER_TIMEOUT)
    running = db.scalars(
        select(TrainingJob).where(TrainingJob.status == TrainingStatus.RUNNING).with_for_update(skip_locked=True)
    ).all()
    for job in running:
        worker = db.get(TrainingWorker, job.worker_name) if job.worker_name else None
        if worker is None or worker.last_seen_at < cutoff:
            job.status = TrainingStatus.FAILED
            job.error = "The training worker stopped responding."
            job.finished_at = now


def _append_log(job: TrainingJob, lines: Sequence[str]) -> None:
    if not lines:
        return
    kept = (job.log.splitlines() if job.log else []) + [line.rstrip()[:500] for line in lines]
    job.log = "\n".join(kept[-LOG_LINES_KEPT:])
