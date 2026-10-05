import importlib.util
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(importlib.util.find_spec("cv2"), "opencv-python not installed")
class ClipRecorderTest(unittest.TestCase):
    def test_clip_holds_frames_before_and_after_the_accident(self):
        import cv2
        import numpy as np

        from ai.clip_recorder import ClipRecorder

        fps, seconds = 10, 1.0  # 10 frames before + 10 after
        recorder = ClipRecorder(fps, seconds)
        image = np.zeros((48, 64, 3), np.uint8)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            finished = []
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
