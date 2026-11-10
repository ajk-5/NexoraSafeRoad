"""Video input for the detector: video files, webcams or RTSP/HTTP streams."""
from __future__ import annotations

from dataclasses import dataclass
import logging
import math
import sys
from typing import Iterator

import cv2
import numpy as np

DEFAULT_FPS = 25.0
log = logging.getLogger("saferoad.ai")


@dataclass(frozen=True)
class CameraInfo:
    """Where a camera is installed. For the MVP the coordinates are configured, not measured."""

    camera_id: str
    latitude: float
    longitude: float


class VideoSource:
    def __init__(self, source: str):
        # "0", "1", ... select a local webcam; anything else is a file path or stream URL.
        self._source = int(source) if source.isdigit() else source
        self._webcam = isinstance(self._source, int)
        self._cap = self._open_capture()
        if not self._cap.isOpened():
            self._cap.release()
            raise RuntimeError(f"Cannot open video source: {source}")
        fps = self._cap.get(cv2.CAP_PROP_FPS)
        self.fps = fps if math.isfinite(fps) and fps > 0 else DEFAULT_FPS

    def _open_capture(self) -> cv2.VideoCapture:
        if self._webcam and sys.platform == "win32":
            # Avoid MSMF's asynchronous ReadSample failures for local webcams.
            cap = cv2.VideoCapture(self._source, cv2.CAP_DSHOW)
            if cap.isOpened():
                return cap
            cap.release()
            log.warning("DirectShow could not open webcam; trying the default capture backend")
        return cv2.VideoCapture(self._source)

    def frames(self) -> Iterator[np.ndarray]:
        while True:
            ok, frame = self._cap.read()
            if not ok:
                if not self._webcam:
                    return  # normal EOF for files
                log.warning("Webcam frame read failed; reopening camera once")
                self._cap.release()
                self._cap = self._open_capture()
                ok, frame = self._cap.read() if self._cap.isOpened() else (False, None)
                if not ok:
                    log.error("Webcam did not recover; stopping capture and flushing pending clips")
                    return
            yield frame

    def close(self) -> None:
        self._cap.release()

    def __enter__(self) -> VideoSource:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
