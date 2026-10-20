import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse

from .. import config
from ..database import utcnow
from ..deps import DB, AdminOperator, ai_client
from ..errors import BadRequest, NotFound
from ..models import AIModel, TrainingDataset, TrainingJob, TrainingStatus
from ..schemas.training import (
    AIModelOut,
    ClaimedDataset,
    ClaimedJob,
    DatasetOut,
    EpochMetrics,
    FeedbackClip,
    FeedbackCounts,
    JobDataset,
    JobEnd,
    ModelInfo,
    ProgressReply,
    ProgressReport,
    TrainingJobCreate,
    TrainingJobOut,
    TrainingOverview,
    WorkerHello,
    WorkerOut,
)
from ..services import dataset_service, training_service

router = APIRouter(prefix="/training", tags=["training"])


def dataset_out(dataset: TrainingDataset) -> DatasetOut:
    return DatasetOut(
        id=dataset.id,
        name=dataset.name,
        size_bytes=dataset.size_bytes,
        class_names=dataset.class_names,
        detector_classes=training_service.detector_classes(dataset.class_names),
        train_images=dataset.train_images,
        val_images=dataset.val_images,
        test_images=dataset.test_images,
        created_at=dataset.created_at,
    )


def model_out(model: AIModel) -> AIModelOut:
    return AIModelOut(
        id=model.id,
        name=model.name,
        source=model.source,
        sha256=model.sha256,
        size_bytes=model.size_bytes,
        class_names=model.class_names,
        map50=model.map50,
        map50_95=model.map50_95,
        precision=model.precision,
        recall=model.recall,
        metrics_note=model.metrics_note,
        is_active=model.is_active,
        created_at=model.created_at,
    )


def model_info(model: AIModel) -> ModelInfo:
    return ModelInfo(
        id=model.id,
        name=model.name,
        source=model.source,
        sha256=model.sha256,
        class_names=model.class_names,
        download_path=training_service.model_download_path(model),
    )


def job_out(job: TrainingJob, with_log: bool = False) -> TrainingJobOut:
    return TrainingJobOut(
        id=job.id,
        status=job.status,
        dataset=JobDataset(id=job.dataset.id, name=job.dataset.name),
        base_name=training_service.base_name(job),
        epochs=job.epochs,
        image_size=job.image_size,
        batch=job.batch,
        use_false_alarms=job.use_false_alarms,
        use_confirmed=job.use_confirmed,
        current_epoch=job.current_epoch,
        history=[EpochMetrics.model_validate(entry) for entry in job.history],
        final_metrics=EpochMetrics.model_validate(job.final_metrics) if job.final_metrics else None,
        log=job.log if with_log else None,
        error=job.error,
        cancel_requested=job.cancel_requested,
        worker_name=job.worker_name,
        result_model_id=job.result_model_id,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


async def save_upload(request: Request, limit_bytes: int, suffix: str) -> tuple[Path, int]:
    """Stream the raw request body to a temporary file, without holding it in memory."""
    folder = training_service.uploads_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{suffix}"
    size = 0
    try:
        with path.open("wb") as out:
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit_bytes:
                    raise BadRequest("FILE_TOO_LARGE", f"The file is larger than {limit_bytes // 1_000_000} MB.")
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    if size == 0:
        path.unlink(missing_ok=True)
        raise BadRequest("EMPTY_FILE", "The uploaded file is empty.")
    return path, size


# ---------- Admin: the "AI Training" page ----------


@router.get("/overview", response_model=TrainingOverview)
def overview(db: DB, _: AdminOperator):
    worker = training_service.latest_worker(db)
    active = training_service.active_model(db)
    false_alarms, confirmed = training_service.feedback_counts(db)
    return TrainingOverview(
        worker=WorkerOut(
            name=worker.name,
            device=worker.device,
            last_seen_at=worker.last_seen_at,
            online=training_service.is_online(worker, utcnow()),
        )
        if worker
        else None,
        active_model=model_out(active) if active else None,
        queued_jobs=training_service.count_jobs(db, TrainingStatus.QUEUED),
        running_jobs=training_service.count_jobs(db, TrainingStatus.RUNNING),
        feedback=FeedbackCounts(false_alarms=false_alarms, confirmed=confirmed),
    )


@router.get("/models", response_model=list[AIModelOut])
def list_models(db: DB, _: AdminOperator):
    return [model_out(m) for m in training_service.list_models(db)]


@router.post("/models/{model_id}/activate", response_model=AIModelOut)
def activate_model(model_id: int, db: DB, _: AdminOperator):
    model = training_service.activate_model(db, model_id)
    db.commit()
    return model_out(model)


@router.get("/datasets", response_model=list[DatasetOut])
def list_datasets(db: DB, _: AdminOperator):
    return [dataset_out(d) for d in dataset_service.list_datasets(db)]


@router.post("/datasets", response_model=DatasetOut, status_code=201)
async def upload_dataset(request: Request, db: DB, admin: AdminOperator, name: str = Query(min_length=1, max_length=100)):
    """Upload a YOLO-format zip as the raw request body (Content-Type: application/zip)."""
    upload, size = await save_upload(request, config.MAX_DATASET_MB * 1_000_000, ".zip")
    dataset = dataset_service.add_dataset(db, name.strip(), upload, size, admin)
    db.commit()
    return dataset_out(dataset)


@router.get("/jobs", response_model=list[TrainingJobOut])
def list_jobs(db: DB, _: AdminOperator):
    return [job_out(j) for j in training_service.list_jobs(db)]


@router.post("/jobs", response_model=TrainingJobOut, status_code=201)
def create_job(body: TrainingJobCreate, db: DB, admin: AdminOperator):
    job = training_service.create_job(db, body, admin)
    db.commit()
    return job_out(training_service.get_job(db, job.id))


@router.get("/jobs/{job_id}", response_model=TrainingJobOut)
def get_job(job_id: int, db: DB, _: AdminOperator):
    return job_out(training_service.get_job(db, job_id), with_log=True)


@router.post("/jobs/{job_id}/cancel", response_model=TrainingJobOut)
def cancel_job(job_id: int, db: DB, _: AdminOperator):
    training_service.cancel_job(db, job_id, utcnow())
    db.commit()
    return job_out(training_service.get_job(db, job_id), with_log=True)


# ---------- Training worker (ai/trainer.py) and detector (ai/main.py) ----------

worker = APIRouter(prefix="/worker", dependencies=[Depends(ai_client)])


@worker.post("/heartbeat", status_code=204)
def worker_heartbeat(body: WorkerHello, db: DB):
    training_service.heartbeat(db, body.name, body.device, utcnow())
    db.commit()


@worker.post("/claim", response_model=ClaimedJob | None)
def claim_job(body: WorkerHello, db: DB):
    """The next queued job for this worker, or null."""
    now = utcnow()
    training_service.heartbeat(db, body.name, body.device, now)
    job = training_service.claim_job(db, body.name, now)
    db.commit()
    if job is None:
        return None
    active = training_service.active_model(db) if job.use_confirmed else None
    return ClaimedJob(
        id=job.id,
        epochs=job.epochs,
        image_size=job.image_size,
        batch=job.batch,
        use_false_alarms=job.use_false_alarms,
        use_confirmed=job.use_confirmed,
        dataset=ClaimedDataset(
            id=job.dataset.id,
            name=job.dataset.name,
            class_names=job.dataset.class_names,
            download_path=f"/api/training/worker/datasets/{job.dataset.id}/file",
        ),
        base_model=model_info(job.base_model) if job.base_model else None,
        base_checkpoint=job.base_checkpoint,
        labeler=model_info(active) if active else None,
    )


@worker.get("/datasets/{dataset_id}/file")
def dataset_file(dataset_id: int, db: DB) -> FileResponse:
    dataset = dataset_service.get_dataset(db, dataset_id)
    return FileResponse(dataset_service.dataset_path(dataset), media_type="application/zip", filename=dataset.file_name)


@worker.get("/models/active", response_model=ModelInfo | None)
def active_model(db: DB):
    """The model the detector should use."""
    model = training_service.active_model(db)
    return model_info(model) if model else None


@worker.get("/models/{model_id}/file")
def model_file(model_id: int, db: DB) -> FileResponse:
    path = training_service.model_file(training_service.get_model(db, model_id))
    if not path.exists():
        raise NotFound("MODEL_FILE_MISSING", f"The weights of model {model_id} are missing on the server.")
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@worker.get("/feedback", response_model=list[FeedbackClip])
def feedback(db: DB, false_alarms: bool = True, confirmed: bool = False):
    clips = training_service.feedback_clips(db, false_alarms, confirmed)
    return [FeedbackClip(incident_id=c.incident_id, label=c.label, video_url=c.video_url) for c in clips]


@worker.post("/jobs/{job_id}/progress", response_model=ProgressReply)
def job_progress(job_id: int, body: ProgressReport, db: DB):
    cancel = training_service.record_progress(db, job_id, body)
    db.commit()
    return ProgressReply(cancel_requested=cancel)


@worker.post("/jobs/{job_id}/end", status_code=204)
def job_end(job_id: int, body: JobEnd, db: DB):
    training_service.end_job(db, job_id, body, utcnow())
    db.commit()


@worker.put("/jobs/{job_id}/model", response_model=ModelInfo)
async def job_model(job_id: int, request: Request, db: DB, name: str = Query(min_length=1, max_length=100)):
    """Upload the trained weights (raw body). Completes the job and registers the model."""
    upload, size = await save_upload(request, config.MAX_DATASET_MB * 1_000_000, ".pt")
    model = training_service.complete_job(db, job_id, name, upload, size, utcnow())
    db.commit()
    return model_info(model)


router.include_router(worker)
