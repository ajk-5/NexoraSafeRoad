"""Training worker for the admin "AI Training" page.

    python -m ai.trainer --backend http://localhost:8000 [--device 0]

Run it on the machine with the GPU. It claims the training jobs admins queue, prepares the
dataset (plus operator feedback), fine-tunes YOLO with ultralytics, reports progress after
every epoch and uploads the trained weights. Admins then compare models and activate one.
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import shutil
import socket
import threading
import time
import zipfile
from collections import Counter, deque
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path, PurePosixPath
from typing import IO, TYPE_CHECKING, Any, Protocol, cast

import cv2
import numpy as np
import yaml

from . import model_store
from .backend_client import BackendClient, BackendError
from .detector import ACCIDENT_LABELS, YoloModel, load_model, predict

if TYPE_CHECKING:
    from cv2.typing import MatLike

log = logging.getLogger("saferoad.trainer")
AI_DIR = Path(__file__).resolve().parent

HEARTBEAT_SECONDS = 10
POLL_SECONDS = 5
FRAMES_PER_CLIP = 6  # frames taken from each incident clip used as feedback
LABEL_CONFIDENCE = 0.5  # minimum confidence for auto-labelling confirmed incidents
MAX_EXTRACT_BYTES = 50 * 1024**3
STOCK_CHECKPOINT = re.compile(r"yolo11[nsmlx]\.pt")

# Same dataset layout rules as backend/services/dataset_service.py.
IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".bmp", ".webp"})
SPLIT_FOLDERS = {"train": "train", "valid": "val", "val": "val", "test": "test"}


# ---------- Dataset ----------


def extract_dataset(archive_path: Path, target: Path, max_bytes: int = MAX_EXTRACT_BYTES) -> dict[str, int]:
    """Extract only images and label files, into target/<split>/{images,labels}/<name>.

    Output paths are built from validated parts only, so a crafted archive cannot write
    outside `target`. Returns the number of images per split.
    """
    counts: Counter[str] = Counter()
    written = 0
    with zipfile.ZipFile(archive_path) as archive:
        yaml_files = [m for m in archive.namelist() if PurePosixPath(m).name == "data.yaml"]
        root = PurePosixPath(min(yaml_files, key=lambda m: m.count("/"))).parent.parts if yaml_files else ()
        for info in archive.infolist():
            placed = None if info.is_dir() else place_member(info.filename, root)
            if placed is None:
                continue
            split, kind, name = placed
            destination = target / split / kind / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, destination.open("wb") as out:
                written = _copy_limited(source, out, written, max_bytes)
            if kind == "images":
                counts[split] += 1
    return dict(counts)


def place_member(member: str, root: Sequence[str]) -> tuple[str, str, str] | None:
    """(split, "images" | "labels", file name) for a dataset file, None for anything else."""
    parts = PurePosixPath(member).parts
    if tuple(parts[: len(root)]) != tuple(root):
        return None
    relative = parts[len(root) :]
    if len(relative) != 3:
        return None
    folder, kind, name = relative
    if folder not in SPLIT_FOLDERS or kind not in ("images", "labels"):
        return None
    # Backslashes and drive letters would let a name escape the folder on Windows.
    if name in (".", "..") or "\\" in name or ":" in name:
        return None
    suffix = PurePosixPath(name).suffix.lower()
    if (kind == "images" and suffix not in IMAGE_SUFFIXES) or (kind == "labels" and suffix != ".txt"):
        return None
    return SPLIT_FOLDERS[folder], kind, name


def _copy_limited(source: IO[bytes], out: IO[bytes], written: int, max_bytes: int) -> int:
    while chunk := source.read(1 << 20):
        written += len(chunk)
        if written > max_bytes:
            raise ValueError(f"The dataset is larger than {max_bytes // 1024**3} GB once extracted.")
        out.write(chunk)
    return written


def write_data_yaml(data_dir: Path, class_names: Sequence[str]) -> Path:
    """Our own data.yaml. Never the dataset's: ultralytics runs code from its `download:` field."""
    config: dict[str, object] = {
        "path": str(data_dir.resolve()),
        "train": "train/images",
        "val": "val/images",
        "names": dict(enumerate(class_names)),
    }
    if (data_dir / "test" / "images").is_dir():
        config["test"] = "test/images"
    path = data_dir / "data.yaml"
    path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return path


# ---------- Operator feedback ----------


def sample_frames(video: Path, count: int = FRAMES_PER_CLIP) -> list[MatLike]:
    """`count` frames spread evenly over the clip."""
    capture = cv2.VideoCapture(str(video))
    try:
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            return []
        indexes = sorted({round(i * (total - 1) / max(count - 1, 1)) for i in range(count)})
        frames: list[MatLike] = []
        for index in indexes:
            capture.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok, frame = capture.read()
            if ok:
                frames.append(frame)
        return frames
    finally:
        capture.release()


def yolo_label(class_id: int, box: tuple[float, float, float, float], width: int, height: int) -> str:
    """A YOLO label line: class, then the box centre and size relative to the image."""
    x1, y1, x2, y2 = (max(0.0, v) for v in box)
    x2, y2 = min(x2, width), min(y2, height)
    return (
        f"{class_id} {(x1 + x2) / 2 / width:.6f} {(y1 + y2) / 2 / height:.6f} "
        f"{(x2 - x1) / width:.6f} {(y2 - y1) / height:.6f}"
    )


def accident_class_id(class_names: Sequence[str]) -> int | None:
    return next((i for i, name in enumerate(class_names) if name.lower() in ACCIDENT_LABELS), None)


def add_feedback(
    client: BackendClient, job: Mapping[str, Any], data_dir: Path, labeler: YoloModel | None, device: str | None
) -> tuple[int, int]:
    """Add frames from reviewed incidents to the training split. Returns (false alarms, accidents).

    Declined incidents become background images (an empty label file: "nothing to detect
    here"), which teaches the model what its false alarms looked like. Confirmed incidents
    are labelled by `labeler` (the active model): the admin confirmed there is an accident,
    the model draws the box.
    """
    clips: list[dict[str, Any]] = client.get(
        "/api/training/worker/feedback",
        {"false_alarms": str(job["useFalseAlarms"]).lower(), "confirmed": str(job["useConfirmed"]).lower()},
    )
    accident_id = accident_class_id(job["dataset"]["classNames"])
    images, labels = data_dir / "train" / "images", data_dir / "train" / "labels"
    images.mkdir(parents=True, exist_ok=True)
    labels.mkdir(parents=True, exist_ok=True)
    false_alarms = accidents = 0
    for clip in clips:
        video = data_dir / "feedback" / f"incident-{clip['incidentId']}.mp4"
        try:
            client.download(str(clip["videoUrl"]), video)
        except BackendError as exc:
            log.warning("Skipping the clip of incident %s: %s", clip["incidentId"], exc)
            continue
        for k, frame in enumerate(sample_frames(video)):
            stem = f"feedback-incident-{clip['incidentId']}-{k}"
            if clip["label"] == "false_alarm":
                lines: list[str] = []
            elif labeler is not None and accident_id is not None:
                height, width = frame.shape[:2]
                boxes = [d.box for d in predict(labeler, np.asarray(frame), LABEL_CONFIDENCE, device) if d.label in ACCIDENT_LABELS]
                if not boxes:
                    continue  # e.g. a frame from before the crash
                lines = [yolo_label(accident_id, box, width, height) for box in boxes]
            else:
                continue
            cv2.imwrite(str(images / f"{stem}.jpg"), frame)
            (labels / f"{stem}.txt").write_text("\n".join(lines), encoding="utf-8")
            if lines:
                accidents += 1
            else:
                false_alarms += 1
    shutil.rmtree(data_dir / "feedback", ignore_errors=True)
    return false_alarms, accidents


# ---------- Training ----------


class _Trainer(Protocol):
    """The parts of ultralytics' trainer the callbacks read (ultralytics is only partly typed)."""

    epoch: int
    epochs: int
    stop: bool
    metrics: dict[str, Any] | None
    tloss: Any

    def label_loss_items(self, loss_items: Any = None, prefix: str = "train") -> Any: ...


class _TrainableModel(Protocol):
    def add_callback(self, event: str, callback: Callable[[Any], None]) -> None: ...
    def train(self, **kwargs: Any) -> Any: ...


def _number(value: object) -> float | None:
    return round(float(value), 5) if isinstance(value, (int, float)) else None


def epoch_metrics(trainer: _Trainer, epoch: int) -> dict[str, Any]:
    metrics = trainer.metrics or {}
    losses: dict[str, Any] = trainer.label_loss_items(trainer.tloss) if trainer.tloss is not None else {}
    return {
        "epoch": epoch,
        "precision": _number(metrics.get("metrics/precision(B)")),
        "recall": _number(metrics.get("metrics/recall(B)")),
        "map50": _number(metrics.get("metrics/mAP50(B)")),
        "map50_95": _number(metrics.get("metrics/mAP50-95(B)")),
        "box_loss": _number(losses.get("train/box_loss")),
        "cls_loss": _number(losses.get("train/cls_loss")),
    }


class LogBuffer(logging.Handler):
    """Collects log lines (ours and ultralytics') to send with the next progress report."""

    ANSI = re.compile(r"\x1b\[[0-9;]*m")

    def __init__(self) -> None:
        super().__init__(logging.INFO)
        self._lines: deque[str] = deque(maxlen=500)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        text = self.ANSI.sub("", record.getMessage())
        with self._lock:
            self._lines.extend(line for line in text.splitlines() if line.strip())

    def drain(self) -> list[str]:
        with self._lock:
            lines = list(self._lines)
            self._lines.clear()
        return lines


class _Poster(Protocol):
    def post(self, path: str, payload: object) -> Any: ...


class ProgressReporter:
    """Reports every epoch to the backend, and stops training when an admin cancels."""

    def __init__(self, client: _Poster, job_id: int, worker_name: str, logs: LogBuffer):
        self.client, self.job_id, self.worker_name, self.logs = client, job_id, worker_name, logs
        self.cancelled = False
        self._epoch_trained = False

    def on_train_epoch_end(self, trainer: _Trainer) -> None:
        self._epoch_trained = True

    def on_fit_epoch_end(self, trainer: _Trainer) -> None:
        # Ultralytics calls this after each epoch's validation, and once more after training
        # to validate the best weights (with trainer.epoch already advanced): that is `final`.
        final = not self._epoch_trained
        self._epoch_trained = False
        metrics = epoch_metrics(trainer, trainer.epoch if final else trainer.epoch + 1)
        try:
            reply = self.report(metrics, final)
        except BackendError as exc:
            log.warning("Could not report progress: %s", exc)  # training goes on regardless
            return
        if not final and reply.get("cancelRequested"):
            log.info("Cancelled by an admin, stopping after this epoch")
            trainer.stop = True
            self.cancelled = True

    def report(self, metrics: dict[str, Any], final: bool) -> dict[str, Any]:
        payload = {"name": self.worker_name, "metrics": metrics, "logLines": self.logs.drain(), "final": final}
        return self.client.post(f"/api/training/worker/jobs/{self.job_id}/progress", payload) or {}


def base_weights(client: BackendClient, job: Mapping[str, Any]) -> str:
    if job.get("baseModel"):
        return str(model_store.local_model(client, job["baseModel"]))
    checkpoint = str(job["baseCheckpoint"])
    if not STOCK_CHECKPOINT.fullmatch(checkpoint):
        raise ValueError(f"Unsupported base checkpoint {checkpoint!r}")
    return str(AI_DIR / "model" / checkpoint)  # stock COCO weights, downloaded there by ultralytics


def run_job(client: BackendClient, job: Mapping[str, Any], args: argparse.Namespace) -> None:
    job_id = int(job["id"])
    work = Path(args.work_dir) / f"job-{job_id}"
    shutil.rmtree(work, ignore_errors=True)
    logs = LogBuffer()
    watched = [log, logging.getLogger("ultralytics")]
    for logger in watched:
        logger.addHandler(logs)
    reporter = ProgressReporter(client, job_id, args.name, logs)
    try:
        data_yaml = prepare_dataset(client, job, work / "data", args.device)
        from ultralytics import YOLO

        model = cast(_TrainableModel, YOLO(base_weights(client, job)))
        model.add_callback("on_train_epoch_end", reporter.on_train_epoch_end)
        model.add_callback("on_fit_epoch_end", reporter.on_fit_epoch_end)
        log.info("Training %s epochs at %spx, batch %s", job["epochs"], job["imageSize"], job["batch"])
        model.train(
            data=str(data_yaml),
            epochs=int(job["epochs"]),
            imgsz=int(job["imageSize"]),
            batch=int(job["batch"]),
            device=args.device,
            workers=args.workers,
            project=str(work / "runs"),
            name="train",
            exist_ok=True,
            plots=False,
        )
        if reporter.cancelled:
            _end(client, job_id, args.name, "CANCELLED", None, logs)
            return
        best = work / "runs" / "train" / "weights" / "best.pt"
        log.info("Uploading the trained weights (%.0f MB)", best.stat().st_size / 1e6)
        client.put_file(f"/api/training/worker/jobs/{job_id}/model", best, "application/octet-stream", {"name": args.name})
        log.info("Job %s completed", job_id)
    except KeyboardInterrupt:
        _end(client, job_id, args.name, "FAILED", "The training worker was stopped.", logs)
        raise
    except Exception as exc:
        log.exception("Job %s failed", job_id)
        _end(client, job_id, args.name, "FAILED", f"{type(exc).__name__}: {exc}"[:4000], logs)
    finally:
        for logger in watched:
            logger.removeHandler(logs)
        shutil.rmtree(work, ignore_errors=True)


def prepare_dataset(client: BackendClient, job: Mapping[str, Any], data_dir: Path, device: str | None) -> Path:
    dataset = job["dataset"]
    archive = data_dir.parent / "dataset.zip"
    log.info("Downloading dataset %s", dataset["name"])
    client.download(str(dataset["downloadPath"]), archive)
    counts = extract_dataset(archive, data_dir)
    archive.unlink()
    log.info("Dataset: %s training and %s validation images", counts.get("train", 0), counts.get("val", 0))

    if job["useFalseAlarms"] or job["useConfirmed"]:
        labeler = None
        if job["useConfirmed"] and job.get("labeler"):
            labeler = load_model(str(model_store.local_model(client, job["labeler"])))
        false_alarms, accidents = add_feedback(client, job, data_dir, labeler, device)
        log.info("Operator feedback: %s false-alarm frames, %s confirmed-accident frames", false_alarms, accidents)
    return write_data_yaml(data_dir, dataset["classNames"])


def _end(client: BackendClient, job_id: int, name: str, status: str, error: str | None, logs: LogBuffer) -> None:
    try:
        client.post(
            f"/api/training/worker/jobs/{job_id}/end",
            {"name": name, "status": status, "error": error, "logLines": logs.drain()},
        )
    except BackendError as exc:
        log.error("Could not report the end of job %s: %s", job_id, exc)


# ---------- Worker loop ----------


def describe_device(device: str | None) -> str:
    import torch

    if device == "cpu" or not torch.cuda.is_available():
        return "CPU"
    return torch.cuda.get_device_name(int(device) if device and device.isdigit() else 0)


def heartbeat_loop(client: BackendClient, hello: dict[str, str], stop: threading.Event) -> None:
    """Runs alongside training so the backend knows the worker is alive during long epochs."""
    while not stop.wait(HEARTBEAT_SECONDS):
        try:
            client.post("/api/training/worker/heartbeat", hello)
        except BackendError as exc:
            log.debug("Heartbeat failed: %s", exc)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Nexora SafeRoad training worker")
    p.add_argument("--backend", default="http://localhost:8000", help="backend base URL")
    p.add_argument("--api-key", default=os.environ.get("AI_API_KEY", "dev-ai-key"), help="backend AI_API_KEY")
    p.add_argument("--device", help="'0' for the first GPU or 'cpu' (default: auto)")
    p.add_argument("--name", default=socket.gethostname(), help="worker name shown to admins")
    p.add_argument("--workers", type=int, default=2, help="dataloader worker processes")
    p.add_argument("--work-dir", default=str(AI_DIR / "training"), help="temporary folder for datasets and runs")
    return p.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = parse_args()
    Path(args.work_dir).mkdir(parents=True, exist_ok=True)

    client = BackendClient(args.backend, args.api_key, timeout=120)
    hello = {"name": args.name, "device": describe_device(args.device)}
    stop = threading.Event()
    threading.Thread(target=heartbeat_loop, args=(client, hello, stop), daemon=True).start()
    log.info("Training worker %s (%s) waiting for jobs from %s", hello["name"], hello["device"], args.backend)
    try:
        while True:
            try:
                job = client.post("/api/training/worker/claim", hello)
            except BackendError as exc:
                log.warning("Backend unreachable: %s", exc)
                job = None
            if job is None:
                time.sleep(POLL_SECONDS)
                continue
            log.info("Claimed training job %s on dataset %s", job["id"], job["dataset"]["name"])
            run_job(client, job, args)
    except KeyboardInterrupt:
        log.info("Stopped")
    finally:
        stop.set()


if __name__ == "__main__":
    main()
