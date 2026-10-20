"""Run accident detection on a video source.

Example (from the repository root):
    python -m ai.main --source dataset/videos/crash.mp4 --lat 48.8566 --lon 2.3522 --show
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from . import model_store
from .alerts import IncidentReport, log_incident, send_incident
from .backend_client import BackendClient, BackendError
from .camera import CameraInfo, VideoSource
from .clip_recorder import ClipRecorder
from .detector import EVENT_LABELS, AccidentConfirmer, AccidentDetector, ConfirmedAccident, FrameAnalysis
from .severity import classify

log = logging.getLogger("saferoad.ai")
AI_DIR = Path(__file__).resolve().parent
ACCIDENT_MODEL = AI_DIR / "model" / "accident_model.pt"  # see ai/download_models.py


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Nexora SafeRoad accident detection")
    p.add_argument("--source", required=True, help="video file, webcam index (0) or stream URL")
    p.add_argument("--camera-id", default="cam-01")
    p.add_argument("--lat", type=float, default=48.8566, help="camera latitude (simulated for the MVP)")
    p.add_argument("--lon", type=float, default=2.3522, help="camera longitude (simulated for the MVP)")
    p.add_argument("--object-model", default=str(AI_DIR / "model" / "yolo11n.pt"), help="COCO YOLO weights")
    p.add_argument(
        "--accident-model",
        help="YOLO weights trained on accidents (default: the model active on the backend, else model/accident_model.pt)",
    )
    p.add_argument("--accident-conf", type=float, default=0.25, help="minimum accident confidence in a frame")
    p.add_argument("--confirm-frames", type=int, default=5, help="consecutive frames needed to confirm")
    p.add_argument("--clip-seconds", type=float, default=10.0, help="footage kept before and after")
    p.add_argument("--cooldown", type=float, default=30.0, help="seconds before this camera can report again")
    p.add_argument("--output", default=str(AI_DIR / "output"), help="folder for clips and incident JSON")
    p.add_argument("--backend", help="backend base URL, e.g. http://localhost:8000")
    p.add_argument("--api-key", default=os.environ.get("AI_API_KEY", "dev-ai-key"), help="backend AI_API_KEY")
    p.add_argument("--device", help="'0' for the first GPU or 'cpu' (default: auto)")
    p.add_argument("--show", action="store_true", help="display the annotated video (press q to quit)")
    return p.parse_args()


def choose_accident_model(args: argparse.Namespace) -> str | None:
    """--accident-model, else the model an admin activated on the AI Training page, else the local file."""
    if args.accident_model:
        return str(args.accident_model)
    if args.backend:
        client = BackendClient(args.backend, args.api_key, timeout=120)
        try:
            active = client.get("/api/training/worker/models/active")
            if active:
                path = model_store.local_model(client, active)
                log.info("Using the active model from the backend: %s", active["name"])
                return str(path)
        except BackendError as exc:
            log.warning("Could not get the active model from the backend (%s), using the local one", exc)
    return str(ACCIDENT_MODEL) if ACCIDENT_MODEL.exists() else None


def build_incident(camera: CameraInfo, accident: ConfirmedAccident, video_time: float) -> IncidentReport:
    severity = classify(accident.vehicles, accident.people, accident.fire, accident.overturned)
    return {
        "type": "traffic_accident",
        "camera_id": camera.camera_id,
        "latitude": camera.latitude,
        "longitude": camera.longitude,
        "severity": severity.value,
        "confidence": round(accident.confidence, 2),
        "vehicles": accident.vehicles,
        "people": accident.people,
        "fire": accident.fire,
        "overturned": accident.overturned,
        "detected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "video_time": round(video_time, 1),
    }


def deliver(incident: IncidentReport, clip_path: Path, backend_url: str | None, api_key: str) -> None:
    incident["clip_path"] = str(clip_path)
    clip_path.with_suffix(".json").write_text(json.dumps(incident, indent=2))
    log_incident(incident)
    if backend_url:
        send_incident(incident, clip_path, backend_url, api_key)


def draw(frame: np.ndarray, analysis: FrameAnalysis) -> None:
    for d in analysis.detections:
        color = (0, 0, 255) if d.label in EVENT_LABELS else (0, 200, 0)
        x1, y1, x2, y2 = map(int, d.box)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{d.label} {d.confidence:.2f}", (x1, max(y1 - 5, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    status = f"vehicles {analysis.vehicles}  people {analysis.people}  accident {analysis.accident_confidence:.2f}"
    cv2.putText(frame, status, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255) if analysis.accident else (255, 255, 255), 2)


def run(args: argparse.Namespace) -> None:
    camera = CameraInfo(args.camera_id, args.lat, args.lon)
    detector = AccidentDetector(
        args.object_model, choose_accident_model(args), accident_conf=args.accident_conf, device=args.device
    )
    if detector.uses_heuristic:
        log.warning("No accident model: using the vehicle-overlap placeholder, expect false positives")
    confirmer = AccidentConfirmer(args.confirm_frames)
    output = Path(args.output)

    with VideoSource(args.source) as video:
        recorder = ClipRecorder(video.fps, args.clip_seconds)
        last_report = -math.inf
        for index, frame in enumerate(video.frames()):
            video_time = index / video.fps
            analysis = detector.analyze(frame)
            finished = recorder.push(frame)

            accident = confirmer.update(analysis)
            if accident and video_time - last_report >= args.cooldown:
                last_report = video_time
                incident = build_incident(camera, accident, video_time)
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                recorder.start(output / f"{camera.camera_id}_{stamp}_f{index}.mp4", incident)
                log.info("Accident confirmed at %.1fs (%s), recording clip", video_time, incident["severity"])

            for clip_path, incident in finished:
                deliver(incident, clip_path, args.backend, args.api_key)

            if args.show:
                draw(frame, analysis)
                cv2.imshow("Nexora SafeRoad", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        for clip_path, incident in recorder.flush():
            deliver(incident, clip_path, args.backend, args.api_key)

    if args.show:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    run(parse_args())
