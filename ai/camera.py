"""Video input for the detector: video files, webcams or RTSP/HTTP streams."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import cv2
import numpy as np

DEFAULT_FPS = 25.0


@dataclass(frozen=True)
class CameraInfo:
    """Where a camera is installed. For the MVP the coordinates are configured, not measured."""

    camera_id: str
    latitude: float
    longitude: float


class VideoSource:
    def __init__(self, source: str):
        # "0", "1", ... select a local webcam; anything else is a file path or stream URL.
        self._cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {source}")
        fps = self._cap.get(cv2.CAP_PROP_FPS)
        self.fps = fps if fps and fps > 0 else DEFAULT_FPS  # some streams report 0

    def frames(self) -> Iterator[np.ndarray]:
        while True:
            ok, frame = self._cap.read()
            if not ok:
                return
            yield frame

    def close(self) -> None:
        self._cap.release()

    def __enter__(self) -> VideoSource:
        return self

    def __exit__(self, *exc) -> None:
        self.close()
