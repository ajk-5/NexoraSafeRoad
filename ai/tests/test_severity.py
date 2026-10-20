import unittest

from ai.severity import Severity, classify


class ClassifyTest(unittest.TestCase):
    def test_single_vehicle_no_people_is_low(self):
        self.assertEqual(classify(vehicles=1, people=0), Severity.LOW)

    def test_multiple_vehicles_or_a_person_is_medium(self):
        self.assertEqual(classify(vehicles=2, people=0), Severity.MEDIUM)
        self.assertEqual(classify(vehicles=1, people=1), Severity.MEDIUM)

    def test_major_collision_or_several_people_is_high(self):
        self.assertEqual(classify(vehicles=3, people=0), Severity.HIGH)
        self.assertEqual(classify(vehicles=1, people=2), Severity.HIGH)

    def test_fire_or_overturned_is_always_high(self):
        self.assertEqual(classify(vehicles=1, people=0, fire=True), Severity.HIGH)
        self.assertEqual(classify(vehicles=1, people=0, overturned=True), Severity.HIGH)


if __name__ == "__main__":
    unittest.main()
