"""The AI training platform: datasets, trained models and the jobs that produce them."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UTCDateTime, enum_type, utcnow
from .enums import ModelSource, TrainingStatus


class TrainingDataset(Base):
    """A YOLO-format dataset uploaded as a zip (e.g. a Roboflow "YOLOv8" export)."""

    __tablename__ = "training_datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    file_name: Mapped[str] = mapped_column(String(100))  # in TRAINING_DIR/datasets
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    class_names: Mapped[list[str]] = mapped_column(JSON)
    train_images: Mapped[int]
    val_images: Mapped[int]
    test_images: Mapped[int]
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("operators.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AIModel(Base):
    """Accident detection weights. Exactly one is active: the one the detector uses."""

    __tablename__ = "ai_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[ModelSource] = mapped_column(enum_type(ModelSource))
    file_name: Mapped[str | None] = mapped_column(String(100))  # TRAINED only, in TRAINING_DIR/models
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    class_names: Mapped[list[str]] = mapped_column(JSON)
    map50: Mapped[float | None]
    map50_95: Mapped[float | None]
    precision: Mapped[float | None]
    recall: Mapped[float | None]
    metrics_note: Mapped[str | None] = mapped_column(String(300))  # where the metrics come from
    is_active: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class TrainingJob(Base):
    """Fine-tunes a base model on a dataset, plus optional operator feedback. Run by `python -m ai.trainer`."""

    __tablename__ = "training_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("training_datasets.id"))
    # Start from one of our models, or from a stock COCO checkpoint such as "yolo11s.pt".
    base_model_id: Mapped[int | None] = mapped_column(ForeignKey("ai_models.id"))
    base_checkpoint: Mapped[str | None] = mapped_column(String(50))
    epochs: Mapped[int]
    image_size: Mapped[int]
    batch: Mapped[int]
    # Operator feedback: declined incidents are false alarms (frames with no accident);
    # confirmed incidents add frames auto-labelled by the active model.
    use_false_alarms: Mapped[bool] = mapped_column(default=True)
    use_confirmed: Mapped[bool] = mapped_column(default=False)

    status: Mapped[TrainingStatus] = mapped_column(enum_type(TrainingStatus), default=TrainingStatus.QUEUED, index=True)
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    worker_name: Mapped[str | None] = mapped_column(String(100))
    current_epoch: Mapped[int] = mapped_column(default=0)
    # One entry per epoch: {"epoch", "precision", "recall", "map50", "map50_95", "box_loss", "cls_loss"}.
    history: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    final_metrics: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    log: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str | None] = mapped_column(Text)
    result_model_id: Mapped[int | None] = mapped_column(ForeignKey("ai_models.id"))

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("operators.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    dataset: Mapped[TrainingDataset] = relationship()
    base_model: Mapped[AIModel | None] = relationship(foreign_keys=[base_model_id])
    result_model: Mapped[AIModel | None] = relationship(foreign_keys=[result_model_id])


class TrainingWorker(Base):
    """A machine running `python -m ai.trainer`, known from its heartbeats."""

    __tablename__ = "training_workers"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    device: Mapped[str] = mapped_column(String(200))
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime)
