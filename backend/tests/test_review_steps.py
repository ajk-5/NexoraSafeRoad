"""Confirming an accident before alerting, and handing an incident back to the queue."""
import unittest

from backend.tests.base import ApiTestCase


class ConfirmTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.login("admin1")
        self.incident = self.report()
        self.url = f"/api/incidents/{self.incident['id']}"

    def test_a_new_incident_is_not_confirmed(self):
        self.assertIsNone(self.incident["confirmedAt"])

    def test_confirming_records_the_time_and_keeps_the_lock(self):
        confirmed = self.post(f"{self.url}/confirm", self.owner)
        self.assertEqual(confirmed["status"], "UNDER_REVIEW")
        self.assertIsNotNone(confirmed["confirmedAt"])
        self.assertTrue(confirmed["canEdit"])
        # Confirming twice keeps the first time.
        self.assertEqual(self.post(f"{self.url}/confirm", self.owner)["confirmedAt"], confirmed["confirmedAt"])

    def test_sending_an_alert_confirms_too(self):
        sent = self.post(f"{self.url}/send", self.owner, {"services": ["POLICE"]})
        self.assertEqual(sent["status"], "ALERT_SENT")
        self.assertIsNotNone(sent["confirmedAt"])

    def test_a_confirmed_incident_can_still_be_declined(self):
        self.post(f"{self.url}/confirm", self.owner)
        self.assertEqual(self.post(f"{self.url}/decline", self.owner)["status"], "DECLINED")

    def test_only_the_lock_holder_can_confirm(self):
        other = self.login("admin2")
        error = self.post(f"{self.url}/confirm", other, expect=409)
        self.assertEqual(error["error"], "INCIDENT_ALREADY_ASSIGNED")
        self.assertIsNone(self.get(self.url, self.owner)["confirmedAt"])

    def test_a_decided_incident_cannot_be_confirmed(self):
        self.post(f"{self.url}/decline", self.owner)
        error = self.post(f"{self.url}/confirm", self.owner, expect=409)
        self.assertEqual(error["error"], "INCIDENT_NOT_UNDER_REVIEW")

    def test_service_operators_cannot_confirm(self):
        police = self.login("police1", "POLICE")
        self.post(f"{self.url}/confirm", police, expect=403)


class ReleaseTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.login("admin1")
        self.incident = self.report()
        self.url = f"/api/incidents/{self.incident['id']}"

    def test_a_paused_admin_hands_the_incident_to_another_admin(self):
        other = self.login("admin2")
        self.post(f"{self.url}/confirm", self.owner)
        self.post("/api/operators/pause", self.owner)

        released = self.post(f"{self.url}/release", self.owner)
        self.assertEqual((released["status"], released["assignedAdmin"]), ("ASSIGNED", "admin2"))
        self.assertFalse(released["canEdit"])
        # admin2 makes their own decision: the confirmation does not carry over.
        self.assertIsNone(released["confirmedAt"])
        self.assertEqual(self.me(other)["currentIncidentId"], self.incident["id"])
        me = self.me(self.owner)
        self.assertEqual((me["status"], me["currentIncidentId"]), ("PAUSED", None))

    def test_released_incident_waits_when_nobody_else_is_available(self):
        self.post("/api/operators/pause", self.owner)
        released = self.post(f"{self.url}/release", self.owner)
        self.assertEqual((released["status"], released["assignedAdmin"]), ("WAITING_FOR_OPERATOR", None))

    def test_only_the_lock_holder_can_release(self):
        other = self.login("admin2")
        error = self.post(f"{self.url}/release", other, expect=409)
        self.assertEqual(error["error"], "INCIDENT_ALREADY_ASSIGNED")
        self.assertEqual(self.get(self.url, self.owner)["assignedAdmin"], "admin1")

    def test_a_decided_incident_cannot_be_released(self):
        self.post(f"{self.url}/send", self.owner, {"services": ["POLICE"]})
        error = self.post(f"{self.url}/release", self.owner, expect=409)
        self.assertEqual(error["error"], "INCIDENT_NOT_UNDER_REVIEW")


if __name__ == "__main__":
    unittest.main()
