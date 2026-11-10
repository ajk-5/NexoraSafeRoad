import importlib.util
import unittest
from unittest.mock import Mock, patch


@unittest.skipUnless(importlib.util.find_spec("cv2"), "opencv-python not installed")
class VideoSourceTest(unittest.TestCase):
    def capture(self, reads=()):
        cap = Mock()
        cap.isOpened.return_value = True
        cap.get.return_value = 30.0
        cap.read.side_effect = reads
        return cap

    def test_windows_webcam_uses_directshow_and_recovers_failed_read(self):
        import cv2
        from ai.camera import VideoSource

        first = self.capture([(False, None)])
        recovered = self.capture([(True, "frame")])
        with patch("ai.camera.sys.platform", "win32"), patch(
            "ai.camera.cv2.VideoCapture", side_effect=[first, recovered]
        ) as factory:
            with VideoSource("0") as source:
                self.assertEqual(next(source.frames()), "frame")
            self.assertEqual(factory.call_count, 2)
            factory.assert_called_with(0, cv2.CAP_DSHOW)
        first.release.assert_called_once()
        recovered.release.assert_called_once()

    def test_failed_reconnect_stops_without_looping(self):
        from ai.camera import VideoSource

        first = self.capture([(False, None)])
        second = self.capture([(False, None)])
        with patch("ai.camera.sys.platform", "linux"), patch(
            "ai.camera.cv2.VideoCapture", side_effect=[first, second]
        ) as factory:
            with VideoSource("0") as source:
                self.assertEqual(list(source.frames()), [])
            self.assertEqual(factory.call_count, 2)

    def test_windows_falls_back_when_directshow_cannot_open(self):
        from ai.camera import VideoSource

        failed = self.capture()
        failed.isOpened.return_value = False
        fallback = self.capture()
        with patch("ai.camera.sys.platform", "win32"), patch(
            "ai.camera.cv2.VideoCapture", side_effect=[failed, fallback]
        ) as factory:
            with VideoSource("1"):
                pass
            factory.assert_called_with(1)
        failed.release.assert_called_once()

    def test_file_eof_does_not_reconnect(self):
        from ai.camera import VideoSource

        cap = self.capture([(False, None)])
        cap.get.return_value = float("nan")
        with patch("ai.camera.cv2.VideoCapture", return_value=cap) as factory:
            with VideoSource("clip.mp4") as source:
                self.assertEqual(source.fps, 25.0)
                self.assertEqual(list(source.frames()), [])
            factory.assert_called_once_with("clip.mp4")
