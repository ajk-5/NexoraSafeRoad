import unittest

from ai.detector import AccidentConfirmer, Detection, FrameAnalysis, collision_score, iou


def car(x: float, conf: float = 0.9) -> Detection:
    return Detection("car", conf, (x, 0.0, x + 100.0, 100.0))


def frame(accident_conf: float = 0.0, vehicles: int = 0, people: int = 0) -> FrameAnalysis:
    detections = [car(i * 200) for i in range(vehicles)]
    detections += [Detection("person", 0.8, (0, 0, 10, 10)) for _ in range(people)]
    return FrameAnalysis(detections, accident_confidence=accident_conf)


class CollisionScoreTest(unittest.TestCase):
    def test_iou(self):
        self.assertAlmostEqual(iou((0, 0, 10, 10), (0, 0, 10, 10)), 1.0)
        self.assertAlmostEqual(iou((0, 0, 10, 10), (5, 0, 15, 10)), 50 / 150)
        self.assertEqual(iou((0, 0, 10, 10), (20, 0, 30, 10)), 0.0)

    def test_overlapping_vehicles_score_lowest_confidence(self):
        self.assertAlmostEqual(collision_score([car(0, 0.9), car(20, 0.6)]), 0.6)

    def test_separate_vehicles_score_zero(self):
        self.assertEqual(collision_score([car(0), car(500)]), 0.0)

    def test_person_overlapping_a_vehicle_is_ignored(self):
        self.assertEqual(collision_score([car(0), Detection("person", 0.9, (0, 0, 100, 100))]), 0.0)


class AccidentConfirmerTest(unittest.TestCase):
    def test_confirms_after_required_consecutive_frames(self):
        confirmer = AccidentConfirmer(required_frames=3)
        self.assertIsNone(confirmer.update(frame(0.8)))
        self.assertIsNone(confirmer.update(frame(0.8)))
        self.assertIsNotNone(confirmer.update(frame(0.8)))

    def test_negative_frame_resets_the_streak(self):
        confirmer = AccidentConfirmer(required_frames=3)
        confirmer.update(frame(0.8))
        confirmer.update(frame(0.8))
        confirmer.update(frame(0.0))
        self.assertIsNone(confirmer.update(frame(0.8)))
        self.assertIsNone(confirmer.update(frame(0.8)))
        self.assertIsNotNone(confirmer.update(frame(0.8)))

    def test_reports_once_per_streak_and_again_after_a_break(self):
        confirmer = AccidentConfirmer(required_frames=2)
        results = [confirmer.update(frame(0.8)) for _ in range(6)]
        self.assertEqual(sum(r is not None for r in results), 1)
        confirmer.update(frame(0.0))
        confirmer.update(frame(0.8))
        self.assertIsNotNone(confirmer.update(frame(0.8)))

    def test_aggregates_mean_confidence_and_peak_counts(self):
        confirmer = AccidentConfirmer(required_frames=2)
        confirmer.update(frame(0.6, vehicles=1, people=2))
        result = confirmer.update(frame(1.0, vehicles=3, people=0))
        self.assertAlmostEqual(result.confidence, 0.8)
        self.assertEqual(result.vehicles, 3)
        self.assertEqual(result.people, 2)


if __name__ == "__main__":
    unittest.main()
