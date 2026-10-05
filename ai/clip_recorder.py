"""Keeps a rolling buffer of recent frames so we can save the footage from
`seconds` before an accident until `seconds` after it."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

# avc1 (H.264) plays in browsers but needs OpenH264 on Windows; mp4v always works.
CODECS = ("avc1", "mp4v")


@dataclass
class _Clip:
    path: Path
    frames: list[bytes]
    remaining: int
    payload: Any


class ClipRecorder:
    def __init__(self, fps: float, seconds: float = 10.0, jpeg_quality: int = 85):
        self.fps = fps
        self._window = max(1, round(fps * seconds))
        # Frames are kept JPEG-encoded: 10 s of raw 1080p video would take ~2 GB of RAM.
        self._recent: deque[bytes] = deque(maxlen=self._window)
        self._pending: list[_Clip] = []
        self._jpeg_params = [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality]
        self._size: tuple[int, int] | None = None
        self._codec: str | None = None

    def push(self, image: np.ndarray) -> list[tuple[Path, Any]]:
        """Add a frame. Returns (path, payload) for every clip completed by it."""
        ok, buf = cv2.imencode(".jpg", image, self._jpeg_params)
        if not ok:
            return []
        data = buf.tobytes()
        self._size = (image.shape[1], image.shape[0])
        self._recent.append(data)
        for clip in self._pending:
            clip.frames.append(data)
            clip.remaining -= 1
        done = [c for c in self._pending if c.remaining <= 0]
        self._pending = [c for c in self._pending if c.remaining > 0]
        return [self._write(c) for c in done]

    def start(self, path: Path, payload: Any = None) -> None:
        """Begin a clip around the most recently pushed frame."""
        self._pending.append(_Clip(path, list(self._recent), self._window, payload))

    def flush(self) -> list[tuple[Path, Any]]:
        """Write unfinished clips with the frames collected so far (e.g. end of video)."""
        done, self._pending = self._pending, []
        return [self._write(c) for c in done if c.frames]

    def _write(self, clip: _Clip) -> tuple[Path, Any]:
        clip.path.parent.mkdir(parents=True, exist_ok=True)
        writer = self._open_writer(clip.path)
        try:
            for data in clip.frames:
                writer.write(cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR))
        finally:
            writer.release()
        return clip.path, clip.payload

    def _open_writer(self, path: Path) -> cv2.VideoWriter:
        for codec in [self._codec] if self._codec else CODECS:
            writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*codec), self.fps, self._size)
            if writer.isOpened():
                self._codec = codec
                return writer
        raise RuntimeError(f"Cannot open a video writer for {path}")
