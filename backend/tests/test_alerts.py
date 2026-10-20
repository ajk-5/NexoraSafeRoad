"""Sending alerts and the service operator intervention flow (README sections 18-21)."""
import unittest
from typing import Any

from backend.models import Role
from backend.tests.base import ApiTestCase, Headers


class AlertTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.login("admin1")
        self.police = self.login("police1", Role.POLICE)
        self.ambulance = self.login("ambulance1", Role.AMBULANCE)
        self.pompiers = self.login("pompiers1", Role.POMPIERS)

    def send(self, services: list[str]) -> dict[str, Any]:
        incident_id = self.me(self.admin)["currentIncidentId"] or self.report()["id"]
        return self.post(f"/api/incidents/{incident_id}/send", self.admin, {"services": services})

    def alert_for(self, headers: Headers, incident_id: int) -> dict[str, Any]:
        return next(a for a in self.get("/api/alerts", headers) if a["incidentId"] == incident_id)

    def test_admin_can_change_the_ai_suggestion_before_sending(self):
        incident = self.report()  # 3 vehicles, 1 person, no fire: no Pompiers suggested
        self.assertEqual([s["service"] for s in incident["suggestedServices"]], ["POLICE", "AMBULANCE", "DEPANNAGE"])
        sent = self.post(
            f"/api/incidents/{incident['id']}/send", self.admin, {"services": ["POLICE", "AMBULANCE", "POMPIERS"]}
        )
        self.assertEqual(sent["status"], "ALERT_SENT")
        self.assertEqual(
            [(a["serviceType"], a["status"]) for a in sent["alerts"]],
            [("POLICE", "SENT"), ("AMBULANCE", "SENT"), ("POMPIERS", "SENT")],
        )

    def test_service_operators_only_see_their_own_service(self):
        incident = self.send(["POLICE"])
        self.assertEqual(len(self.get("/api/alerts", self.police)), 1)
        self.assertEqual(self.get("/api/alerts", self.pompiers), [])
        self.assertEqual(self.get("/api/incidents", self.pompiers), [])
        self.assertEqual(self.client.get(f"/api/incidents/{incident['id']}", headers=self.pompiers).status_code, 404)
        self.assertEqual(self.get(f"/api/incidents/{incident['id']}", self.police)["reference"], incident["reference"])

    def test_first_operator_to_accept_takes_the_intervention(self):
        incident = self.send(["POLICE"])
        other_police = self.login("police2", Role.POLICE)
        alert = self.alert_for(self.police, incident["id"])
        self.assertTrue(alert["canAccept"])

        accepted = self.post(f"/api/alerts/{alert['id']}/accept", self.police)
        self.assertEqual((accepted["status"], accepted["assignedOperator"]), ("ACCEPTED", "police1"))
        error = self.post(f"/api/alerts/{alert['id']}/accept", other_police, expect=409)
        self.assertEqual(error["error"], "ALERT_ALREADY_ACCEPTED")
        error = self.post(f"/api/alerts/{alert['id']}/status", other_police, {"status": "EN_ROUTE"}, expect=409)
        self.assertEqual(error["error"], "ALERT_ALREADY_ASSIGNED")

        self.assertEqual(self.me(self.police)["status"], "BUSY")
        self.assertEqual(self.get(f"/api/incidents/{incident['id']}", self.admin)["status"], "IN_PROGRESS")

    def test_an_operator_handles_one_intervention_at_a_time(self):
        first = self.send(["POLICE"])
        second = self.send(["POLICE"])
        self.post(f"/api/alerts/{self.alert_for(self.police, first['id'])['id']}/accept", self.police)
        error = self.post(f"/api/alerts/{self.alert_for(self.police, second['id'])['id']}/accept", self.police, expect=409)
        self.assertEqual(error["error"], "OPERATOR_NOT_AVAILABLE")

    def test_intervention_flow_resolves_the_incident_when_every_service_is_done(self):
        incident = self.send(["POLICE", "AMBULANCE"])
        police = self.alert_for(self.police, incident["id"])["id"]
        ambulance = self.alert_for(self.ambulance, incident["id"])["id"]
        self.post(f"/api/alerts/{police}/accept", self.police)
        self.post(f"/api/alerts/{ambulance}/accept", self.ambulance)

        self.post(f"/api/alerts/{police}/status", self.police, {"status": "EN_ROUTE"})
        self.post(f"/api/alerts/{police}/status", self.police, {"status": "ON_SCENE"})
        error = self.post(f"/api/alerts/{police}/status", self.police, {"status": "EN_ROUTE"}, expect=409)
        self.assertEqual(error["error"], "INVALID_STATUS_CHANGE")
        self.post(f"/api/alerts/{police}/status", self.police, {"status": "RESOLVED"})
        self.assertEqual(self.me(self.police)["status"], "ACTIVE")
        self.assertEqual(self.get(f"/api/incidents/{incident['id']}", self.admin)["status"], "IN_PROGRESS")

        # Steps may be skipped: the ambulance goes straight to RESOLVED.
        resolved = self.post(f"/api/alerts/{ambulance}/status", self.ambulance, {"status": "RESOLVED"})
        self.assertFalse(resolved["canUpdate"])
        incident = self.get(f"/api/incidents/{incident['id']}", self.admin)
        self.assertEqual(incident["status"], "RESOLVED")
        self.assertIsNotNone(incident["resolvedAt"])

    def test_accepting_goes_through_the_accept_endpoint(self):
        incident = self.send(["POLICE"])
        alert = self.alert_for(self.police, incident["id"])
        self.post(f"/api/alerts/{alert['id']}/status", self.police, {"status": "ACCEPTED"}, expect=422)


if __name__ == "__main__":
    unittest.main()
