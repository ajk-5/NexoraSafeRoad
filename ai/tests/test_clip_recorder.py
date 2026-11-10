import importlib.util
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch


@unittest.skipUnless(importlib.util.find_spec("cv2"), "opencv-python not installed")
class ClipRecorderTest(unittest.TestCase):
    def test_windows_prefers_mp4v_without_trying_openh264(self):
        import cv2
        from ai.clip_recorder import ClipRecorder

        recorder = ClipRecorder(10)
        recorder._size = (64, 48)
        writer = Mock()
        writer.isOpened.return_value = True
        with patch("ai.clip_recorder.sys.platform", "win32"), patch(
            "ai.clip_recorder.cv2.VideoWriter", return_value=writer
        ) as factory:
            self.assertIs(recorder._open_writer(Path("clip.mp4")), writer)
            factory.assert_called_once_with("clip.mp4", cv2.VideoWriter_fourcc(*"mp4v"), 10, (64, 48))

    def test_cached_encoder_failure_tries_alternative_and_releases_writer(self):
        from ai.clip_recorder import ClipRecorder

        recorder = ClipRecorder(10)
        recorder._size = (64, 48)
        recorder._codec = "avc1"
        failed, working = Mock(), Mock()
        failed.isOpened.return_value = False
        working.isOpened.return_value = True
        with patch("ai.clip_recorder.sys.platform", "linux"), patch(
            "ai.clip_recorder.cv2.VideoWriter", side_effect=[failed, working]
        ):
            self.assertIs(recorder._open_writer(Path("clip.mp4")), working)
        failed.release.assert_called_once()
        self.assertEqual(recorder._codec, "mp4v")

    def test_clip_holds_frames_before_and_after_the_accident(self):
        import cv2
        import numpy as np

        from ai.clip_recorder import ClipRecorder

        fps, seconds = 10, 1.0  # 10 frames before + 10 after
        recorder = ClipRecorder(fps, seconds)
        image = np.zeros((48, 64, 3), np.uint8)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            finished: list[tuple[Path, Any]] = []
            for i in range(30):
                finished += recorder.push(image)
                if i == 14:
                    recorder.start(path, payload="incident")

            self.assertEqual(finished, [(path, "incident")])
            cap = cv2.VideoCapture(str(path))
            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            self.assertEqual(frames, 20)

    def test_flush_writes_unfinished_clips(self):
        import numpy as np

        from ai.clip_recorder import ClipRecorder

        recorder = ClipRecorder(10, 1.0)
        image = np.zeros((48, 64, 3), np.uint8)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            recorder.push(image)
            recorder.start(path)
            self.assertEqual(recorder.flush(), [(path, None)])
            self.assertTrue(path.exists())


if __name__ == "__main__":
    unittest.main()
