"""Training datasets: YOLO-format zips such as a Roboflow "YOLOv8" export.

Expected layout (optionally inside one top folder):
    data.yaml                 with the class names under `names`
    train/images, train/labels
    valid/images, valid/labels   (or val/)
    test/images,  test/labels    (optional)

The backend only lists the archive and reads data.yaml, it never extracts anything.
The training worker extracts the images and labels itself and writes its own data.yaml,
because Ultralytics runs code found in a dataset's `download:` field.
"""
from __future__ import annotations

import shutil
import zipfile
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import cast

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..errors import BadRequest, NotFound
from ..models import Operator, TrainingDataset

IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".bmp", ".webp"})
SPLIT_FOLDERS = {"train": "train", "valid": "val", "val": "val", "test": "test"}  # folder -> split
MAX_YAML_BYTES = 1_000_000
MAX_CLASSES = 100


@dataclass(frozen=True)
class DatasetSummary:
    class_names: list[str]
    images: dict[str, int]  # per split: train, val, test


def datasets_dir() -> Path:
    return config.TRAINING_DIR / "datasets"


def dataset_path(dataset: TrainingDataset) -> Path:
    return datasets_dir() / dataset.file_name


def inspect_zip(path: Path) -> DatasetSummary:
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        raise _invalid("The file is not a zip archive.") from None
    with archive:
        members = archive.namelist()
        yaml_files = [m for m in members if PurePosixPath(m).name == "data.yaml"]
        if not yaml_files:
            raise _invalid('No data.yaml found. Export the dataset in YOLO format (for example Roboflow "YOLOv8").')
        yaml_file = min(yaml_files, key=lambda m: m.count("/"))  # the top-most one
        if archive.getinfo(yaml_file).file_size > MAX_YAML_BYTES:
            raise _invalid("data.yaml is too large.")
        class_names = _class_names(archive.read(yaml_file))
        root = PurePosixPath(yaml_file).parent.parts
        counts = Counter(split for m in members if (split := image_split(m, root)) is not None)

    if counts["train"] == 0:
        raise _invalid("The dataset has no training images (train/images).")
    if counts["val"] == 0:
        raise _invalid("The dataset has no validation images (valid/images). Export it with a validation split.")
    return DatasetSummary(class_names, {split: counts[split] for split in ("train", "val", "test")})


def image_split(member: str, root: Sequence[str]) -> str | None:
    """The split an archive member belongs to if it is a dataset image, else None."""
    parts = PurePosixPath(member).parts
    if tuple(parts[: len(root)]) != tuple(root):
        return None
    relative = parts[len(root) :]
    if (
        len(relative) == 3
        and relative[0] in SPLIT_FOLDERS
        and relative[1] == "images"
        and PurePosixPath(relative[2]).suffix.lower() in IMAGE_SUFFIXES
    ):
        return SPLIT_FOLDERS[relative[0]]
    return None


def _class_names(raw: bytes) -> list[str]:
    try:
        data: object = yaml.safe_load(raw)
    except yaml.YAMLError:
        raise _invalid("data.yaml is not valid YAML.") from None
    if not isinstance(data, dict):
        raise _invalid("data.yaml must list the class names under 'names'.")
    names = cast("dict[object, object]", data).get("names")
    if isinstance(names, dict):  # {0: "accident", 1: "vehicle"}
        mapping = cast("dict[object, object]", names)
        if not all(isinstance(key, int) for key in mapping):
            raise _invalid("data.yaml 'names' must be a list, or a mapping from class number to name.")
        names = [value for _, value in sorted(cast("dict[int, object]", mapping).items())]
    if not isinstance(names, list):
        raise _invalid("data.yaml must list the class names under 'names'.")
    items = cast("list[object]", names)
    cleaned = [n.strip() for n in items if isinstance(n, str) and n.strip()]
    if not items or len(cleaned) != len(items) or len(items) > MAX_CLASSES:
        raise _invalid(f"data.yaml must list 1 to {MAX_CLASSES} class names, all non-empty text.")
    return cleaned


def _invalid(message: str) -> BadRequest:
    return BadRequest("INVALID_DATASET", message)


def add_dataset(db: Session, name: str, upload: Path, size_bytes: int, admin: Operator) -> TrainingDataset:
    """Register an uploaded zip. The upload file is moved into place, or deleted if invalid."""
    try:
        summary = inspect_zip(upload)
    except BadRequest:
        upload.unlink(missing_ok=True)
        raise
    dataset = TrainingDataset(
        name=name,
        file_name="",
        size_bytes=size_bytes,
        class_names=summary.class_names,
        train_images=summary.images["train"],
        val_images=summary.images["val"],
        test_images=summary.images["test"],
        uploaded_by_id=admin.id,
    )
    db.add(dataset)
    db.flush()
    dataset.file_name = f"dataset-{dataset.id}.zip"
    datasets_dir().mkdir(parents=True, exist_ok=True)
    shutil.move(upload, dataset_path(dataset))
    return dataset


def list_datasets(db: Session) -> Sequence[TrainingDataset]:
    return db.scalars(select(TrainingDataset).order_by(TrainingDataset.created_at.desc(), TrainingDataset.id.desc())).all()


def get_dataset(db: Session, dataset_id: int) -> TrainingDataset:
    dataset = db.get(TrainingDataset, dataset_id)
    if dataset is None:
        raise NotFound("DATASET_NOT_FOUND", f"Dataset {dataset_id} does not exist.")
    return dataset
