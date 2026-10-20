from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from ..models import ModelSource, TrainingStatus
from . import Schema

# Stock Ultralytics checkpoints (trained on COCO) a job can start from instead of one of our models.
BaseCheckpoint = Literal["yolo11n.pt", "yolo11s.pt", "yolo11m.pt", "yolo11l.pt", "yolo11x.pt"]


class EpochMetrics(Schema):
    epoch: int = Field(ge=0)
    precision: float | None = None
    recall: float | None = None
    map50: float | None = None
    # mAP50-95: explicit alias, "map5095" would be unreadable.
    map50_95: float | None = Field(default=None, alias="map50_95")
    box_loss: float | None = None
    cls_loss: float | None = None


class DatasetOut(Schema):
    id: int
    name: str
    size_bytes: int
    class_names: list[str]
    # The classes the accident detector reacts to (accident, fire, overturned...).
    detector_classes: list[str]
    train_images: int
    val_images: int
    test_images: int
    created_at: datetime


class AIModelOut(Schema):
    id: int
    name: str
    source: ModelSource
    sha256: str
    size_bytes: int | None
    class_names: list[str]
    map50: float | None
    map50_95: float | None = Field(alias="map50_95")
    precision: float | None
    recall: float | None
    metrics_note: str | None
    is_active: bool
    created_at: datetime


class TrainingJobCreate(Schema):
    dataset_id: int
    base_model_id: int | None = None
    base_checkpoint: BaseCheckpoint | None = None
    epochs: int = Field(default=50, ge=1, le=500)
    image_size: int = Field(default=640, ge=320, le=1280, multiple_of=32)
    batch: int = Field(default=16, ge=1, le=128)
    use_false_alarms: bool = True
    use_confirmed: bool = False

    @model_validator(mode="after")
    def _one_base(self) -> TrainingJobCreate:
        if (self.base_model_id is None) == (self.base_checkpoint is None):
            raise ValueError("Choose exactly one base: one of our models or a stock checkpoint.")
        return self


class JobDataset(Schema):
    id: int
    name: str


class TrainingJobOut(Schema):
    id: int
    status: TrainingStatus
    dataset: JobDataset
    base_name: str
    epochs: int
    image_size: int
    batch: int
    use_false_alarms: bool
    use_confirmed: bool
    current_epoch: int
    history: list[EpochMetrics]
    final_metrics: EpochMetrics | None
    log: str | None  # only in the job detail
    error: str | None
    cancel_requested: bool
    worker_name: str | None
    result_model_id: int | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class WorkerOut(Schema):
    name: str
    device: str
    last_seen_at: datetime
    online: bool


class FeedbackCounts(Schema):
    false_alarms: int  # declined incidents with a clip
    confirmed: int  # incidents an admin sent an alert for, with a clip


class TrainingOverview(Schema):
    worker: WorkerOut | None
    active_model: AIModelOut | None
    queued_jobs: int
    running_jobs: int
    feedback: FeedbackCounts


# ---- Training worker (ai/trainer.py) and detector (ai/main.py), authenticated with X-API-Key ----


class ModelInfo(Schema):
    id: int
    name: str
    source: ModelSource
    sha256: str
    class_names: list[str]
    download_path: str | None  # TRAINED models; PRETRAINED ones are pinned downloads on the AI side


class WorkerHello(Schema):
    name: str = Field(min_length=1, max_length=100)
    device: str = Field(default="", max_length=200)


class ClaimedDataset(Schema):
    id: int
    name: str
    class_names: list[str]
    download_path: str


class ClaimedJob(Schema):
    id: int
    epochs: int
    image_size: int
    batch: int
    use_false_alarms: bool
    use_confirmed: bool
    dataset: ClaimedDataset
    base_model: ModelInfo | None
    base_checkpoint: str | None
    labeler: ModelInfo | None  # auto-labels confirmed incidents (the active model)


class ProgressReport(Schema):
    name: str
    metrics: EpochMetrics
    log_lines: list[str] = Field(default=[], max_length=500)
    final: bool = False  # metrics of the best weights, measured after the last epoch


class ProgressReply(Schema):
    cancel_requested: bool


class JobEnd(Schema):
    name: str
    status: Literal[TrainingStatus.FAILED, TrainingStatus.CANCELLED]
    error: str | None = Field(default=None, max_length=5000)
    log_lines: list[str] = Field(default=[], max_length=500)


class FeedbackClip(Schema):
    incident_id: int
    label: Literal["false_alarm", "accident"]
    video_url: str
