"""Accident detection on single frames, plus confirmation over consecutive frames."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np

VEHICLE_LABELS = {"car", "truck", "bus", "motorcycle", "bicycle"}
PERSON_LABEL = "person"

# Labels we read from our custom accident model (lower-cased class names).
ACCIDENT_LABELS = {"accident", "crash", "collision"}
FIRE_LABELS = {"fire"}
OVERTURNED_LABELS = {"overturned", "rollover"}
EVENT_LABELS = ACCIDENT_LABELS | FIRE_LABELS | OVERTURNED_LABELS


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2 in pixels


@dataclass
class FrameAnalysis:
    detections: list[Detection]
    accident_confidence: float = 0.0  # 0 when no accident is seen in the frame
    fire: bool = False
    overturned: bool = False

    @property
    def accident(self) -> bool:
        return self.accident_confidence > 0

    @property
    def vehicles(self) -> int:
        return sum(d.label in VEHICLE_LABELS for d in self.detections)

    @property
    def people(self) -> int:
        return sum(d.label == PERSON_LABEL for d in self.detections)


class AccidentDetector:
    """Runs YOLO on a frame.

    `object_model` is a COCO-pretrained YOLO used to count vehicles and people.
    `accident_model` is our model trained on the accident dataset. Until it exists,
    a placeholder heuristic (see `collision_score`) stands in for it so the rest of
    the pipeline can be built and demoed end to end.
    """

    def __init__(
        self,
        object_model: str,
        accident_model: str | None = None,
        conf: float = 0.4,
        accident_conf: float = 0.5,
        device: str | None = None,
    ):
        from ultralytics import YOLO  # lazy: keeps the pure logic importable without torch

        self._objects = YOLO(object_model)
        self._accidents = YOLO(accident_model) if accident_model else None
        self.conf = conf
        self.accident_conf = accident_conf
        self.device = device

    @property
    def uses_heuristic(self) -> bool:
        return self._accidents is None

    def analyze(self, image: np.ndarray) -> FrameAnalysis:
        detections = [
            d
            for d in self._predict(self._objects, image, self.conf)
            if d.label in VEHICLE_LABELS or d.label == PERSON_LABEL
        ]
        if self._accidents is None:
            return FrameAnalysis(detections, accident_confidence=collision_score(detections))

        events = [
            d for d in self._predict(self._accidents, image, self.accident_conf) if d.label in EVENT_LABELS
        ]
        return FrameAnalysis(
            detections + events,
            accident_confidence=max((d.confidence for d in events if d.label in ACCIDENT_LABELS), default=0.0),
            fire=any(d.label in FIRE_LABELS for d in events),
            overturned=any(d.label in OVERTURNED_LABELS for d in events),
        )

    def _predict(self, model, image: np.ndarray, conf: float) -> list[Detection]:
        result = model.predict(image, conf=conf, device=self.device, verbose=False)[0]
        boxes = result.boxes
        return [
            Detection(result.names[int(cls)].lower(), float(score), tuple(xyxy))
            for cls, score, xyxy in zip(boxes.cls.tolist(), boxes.conf.tolist(), boxes.xyxy.tolist())
        ]


def iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def collision_score(detections: list[Detection], min_iou: float = 0.3) -> float:
    """Placeholder until the accident model is trained: two vehicles whose boxes
    overlap heavily are treated as a possible collision. Occlusion in dense traffic
    will cause false positives, so this is only for wiring up the pipeline."""
    vehicles = [d for d in detections if d.label in VEHICLE_LABELS]
    best = 0.0
    for i, a in enumerate(vehicles):
        for b in vehicles[i + 1 :]:
            if iou(a.box, b.box) >= min_iou:
                best = max(best, min(a.confidence, b.confidence))
    return best


@dataclass(frozen=True)
class ConfirmedAccident:
    confidence: float  # mean accident confidence over the confirming frames
    vehicles: int  # peak counts over the confirming frames
    people: int
    fire: bool
    overturned: bool


class AccidentConfirmer:
    """Reports an accident only after `required_frames` consecutive positive frames,
    which filters out one-off false detections. Reports once per streak."""

    def __init__(self, required_frames: int = 5):
        self.required_frames = required_frames
        self._streak: list[FrameAnalysis] = []

    def update(self, analysis: FrameAnalysis) -> ConfirmedAccident | None:
        if not analysis.accident:
            self._streak.clear()
            return None
        if len(self._streak) >= self.required_frames:
            return None  # this streak was already reported
        self._streak.append(analysis)
        if len(self._streak) < self.required_frames:
            return None
        streak = self._streak
        return ConfirmedAccident(
            confidence=sum(a.accident_confidence for a in streak) / len(streak),
            vehicles=max(a.vehicles for a in streak),
            people=max(a.people for a in streak),
            fire=any(a.fire for a in streak),
            overturned=any(a.overturned for a in streak),
        )
