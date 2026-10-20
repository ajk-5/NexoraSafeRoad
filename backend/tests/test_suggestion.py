"""The AI suggested response: only the services the situation needs (services/ai_service.py)."""
import unittest

from backend.models import ServiceType
from backend.services.ai_service import suggest
from backend.tests.base import ApiTestCase


def services(vehicles: int, people: int, fire: bool = False, overturned: bool = False) -> list[str]:
    return [s.value for s, _ in suggest(vehicles, people, fire, overturned)]


class SuggestTest(unittest.TestCase):
    def test_minor_single_vehicle_accident_needs_only_the_police(self):
        self.assertEqual(services(vehicles=1, people=0), ["POLICE"])

    def test_collision_without_visible_victims_needs_a_tow_but_no_ambulance_or_fire_brigade(self):
        self.assertEqual(services(vehicles=2, people=0), ["POLICE", "DEPANNAGE"])

    def test_a_person_on_the_scene_brings_an_ambulance(self):
        self.assertEqual(services(vehicles=1, people=1), ["POLICE", "AMBULANCE"])
        self.assertEqual(services(vehicles=2, people=2), ["POLICE", "AMBULANCE", "DEPANNAGE"])

    def test_a_pile_up_brings_an_ambulance_even_with_nobody_visible(self):
        self.assertEqual(services(vehicles=3, people=0), ["POLICE", "AMBULANCE", "DEPANNAGE"])

    def test_fire_brigade_only_for_fire_or_an_overturned_vehicle(self):
        for vehicles, people in [(1, 0), (2, 0), (2, 3), (5, 0)]:
            with self.subTest(vehicles=vehicles, people=people):
                self.assertNotIn("POMPIERS", services(vehicles, people))
        self.assertEqual(services(vehicles=1, people=0, fire=True), ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"])
        self.assertEqual(services(vehicles=1, people=0, overturned=True), ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"])

    def test_reasons_describe_the_situation(self):
        reasons = dict(suggest(vehicles=2, people=1, fire=True, overturned=False))
        self.assertEqual(reasons[ServiceType.POMPIERS], "Vehicle fire")
        self.assertEqual(reasons[ServiceType.AMBULANCE], "1 person on the scene: possible injuries")
        self.assertEqual(reasons[ServiceType.DEPANNAGE], "Remove the burnt vehicle")


class SuggestionApiTest(ApiTestCase):
    def test_the_backend_decides_and_ignores_services_sent_by_the_reporter(self):
        incident = self.report(vehicles=2, people=0, responders=["police", "pompiers", "ambulance", "depannage"])
        self.assertEqual(
            incident["suggestedServices"],
            [
                {"service": "POLICE", "reason": "Secure the scene and manage traffic"},
                {"service": "DEPANNAGE", "reason": "Remove 2 damaged vehicles"},
            ],
        )
        self.assertEqual(incident["selectedServices"], ["POLICE", "DEPANNAGE"])


if __name__ == "__main__":
    unittest.main()
