"""Admin assignment, waiting queue, locking and timeouts (README sections 22-35)."""
import unittest
from datetime import timedelta
from typing import Any

from backend import config
from backend.database import utcnow
from backend.models import Operator
from backend.services import assignment_service, operator_service
from backend.tests.base import ApiTestCase


class AssignmentTest(ApiTestCase):
    def test_new_incident_goes_to_an_active_admin_and_locks_it(self):
        admin = self.login("admin1")
        incident = self.report()
        self.assertEqual(incident["status"], "ASSIGNED")
        self.assertEqual(incident["assignedAdmin"], "admin1")
        me = self.me(admin)
        self.assertEqual((me["status"], me["currentIncidentId"]), ("BUSY", incident["id"]))

    def test_incident_waits_when_no_admin_is_available(self):
        self.assertEqual(self.report()["status"], "WAITING_FOR_OPERATOR")

    def test_waiting_queue_serves_highest_severity_then_oldest(self):
        reports = [
            ("LOW", "10:00"),
            ("HIGH", "10:03"),
            ("MEDIUM", "10:01"),
            ("HIGH", "10:02"),
        ]
        ids = {f"{sev} {t}": self.report(severity=sev, detected_at=f"2026-10-17T{t}:00+00:00")["id"] for sev, t in reports}
        admin = self.login("admin1")

        served: list[str] = []
        for _ in reports:
            current = self.me(admin)["currentIncidentId"]
            served.append(next(k for k, v in ids.items() if v == current))
            self.post(f"/api/incidents/{current}/decline", admin)
        self.assertEqual(served, ["HIGH 10:02", "HIGH 10:03", "MEDIUM 10:01", "LOW 10:00"])
        self.assertEqual(self.me(admin)["status"], "ACTIVE")

    def test_next_incident_goes_to_the_admin_who_waited_longest(self):
        first = self.login("admin1")
        self.login("admin2")
        incident = self.report()
        self.assertEqual(incident["assignedAdmin"], "admin1")
        self.post(f"/api/incidents/{incident['id']}/decline", first)
        # Both are ACTIVE again, but admin2 has not had an incident yet.
        self.assertEqual(self.report()["assignedAdmin"], "admin2")

    def test_paused_admin_keeps_their_incident_but_gets_no_new_one(self):
        admin = self.login("admin1")
        first = self.report()
        self.post("/api/operators/pause", admin)
        me = self.me(admin)
        self.assertEqual((me["status"], me["currentIncidentId"]), ("PAUSED", first["id"]))

        second = self.report()
        self.assertEqual(second["status"], "WAITING_FOR_OPERATOR")
        # Still allowed to finish the incident in hand, and stays paused afterwards.
        self.post(f"/api/incidents/{first['id']}/send", admin, {"services": ["POLICE"]})
        self.assertEqual(self.me(admin)["status"], "PAUSED")
        self.assertEqual(self.get(f"/api/incidents/{second['id']}", admin)["status"], "WAITING_FOR_OPERATOR")

        self.post("/api/operators/resume", admin)
        me = self.me(admin)
        self.assertEqual((me["status"], me["currentIncidentId"]), ("BUSY", second["id"]))

    def test_resuming_with_an_incident_in_hand_means_busy(self):
        admin = self.login("admin1")
        self.report()
        self.post("/api/operators/pause", admin)
        self.assertEqual(self.post("/api/operators/resume", admin)["status"], "BUSY")


class LockingTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.login("admin1")
        self.incident = self.report()
        self.other = self.login("admin2")
        self.url = f"/api/incidents/{self.incident['id']}"

    def test_other_admins_see_it_read_only(self):
        self.assertTrue(self.get(self.url, self.owner)["canEdit"])
        self.assertFalse(self.get(self.url, self.other)["canEdit"])

    def test_other_admins_cannot_change_it(self):
        actions: list[tuple[str, dict[str, Any] | None]] = [
            ("review", None),
            ("draft", {"services": []}),
            ("send", {"services": ["POLICE"]}),
            ("decline", None),
        ]
        for action, body in actions:
            with self.subTest(action):
                error = self.post(f"{self.url}/{action}", self.other, body, expect=409)
                self.assertEqual(error["error"], "INCIDENT_ALREADY_ASSIGNED")

    def test_review_and_draft_keep_the_lock(self):
        self.assertEqual(self.post(f"{self.url}/review", self.owner)["status"], "UNDER_REVIEW")
        draft = self.post(f"{self.url}/draft", self.owner, {"services": ["POLICE", "DEPANNAGE"]})
        self.assertEqual(draft["selectedServices"], ["POLICE", "DEPANNAGE"])
        self.assertTrue(draft["canEdit"])

    def test_a_decided_incident_cannot_be_changed(self):
        self.post(f"{self.url}/decline", self.owner)
        error = self.post(f"{self.url}/send", self.owner, {"services": ["POLICE"]}, expect=409)
        self.assertEqual(error["error"], "INCIDENT_NOT_UNDER_REVIEW")

    def test_sending_needs_at_least_one_service(self):
        self.post(f"{self.url}/send", self.owner, {"services": []}, expect=422)


class TimeoutTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.first = self.login("admin1")
        self.incident = self.report()
        self.second = self.login("admin2")
        self.later = utcnow() + timedelta(seconds=max(config.OFFLINE_TIMEOUT, config.LOCK_TIMEOUT) + 1)

    def heartbeat(self, username: str) -> None:
        with self.Session() as db:
            operator = db.query(Operator).filter_by(username=username).one()
            operator_service.heartbeat(db, operator, self.later)
            db.commit()

    def sweep(self) -> None:
        with self.Session() as db:
            assignment_service.sweep(db, self.later)
            db.commit()

    def test_silent_admin_goes_offline_and_their_incident_moves_to_another_admin(self):
        self.heartbeat("admin2")  # admin1 has gone quiet
        self.sweep()
        self.assertEqual(self.me(self.first)["status"], "OFFLINE")
        incident = self.get(f"/api/incidents/{self.incident['id']}", self.second)
        self.assertEqual((incident["status"], incident["assignedAdmin"]), ("ASSIGNED", "admin2"))
        self.assertTrue(incident["canEdit"])
        error = self.post(f"/api/incidents/{self.incident['id']}/decline", self.first, expect=409)
        self.assertEqual(error["error"], "INCIDENT_ALREADY_ASSIGNED")

    def test_heartbeats_keep_the_lock(self):
        self.heartbeat("admin1")
        self.heartbeat("admin2")
        self.sweep()
        self.assertEqual(self.get(f"/api/incidents/{self.incident['id']}", self.first)["assignedAdmin"], "admin1")

    def test_incident_waits_if_nobody_is_left(self):
        self.sweep()
        incident = self.get(f"/api/incidents/{self.incident['id']}", self.first)
        self.assertEqual((incident["status"], incident["assignedAdmin"]), ("WAITING_FOR_OPERATOR", None))

    def test_offline_admin_comes_back_with_a_heartbeat(self):
        self.sweep()
        self.post("/api/operators/heartbeat", self.first)
        # Back online and the waiting incident is assigned straight away.
        self.assertEqual(self.me(self.first)["currentIncidentId"], self.incident["id"])

    def test_logout_hands_the_incident_over_immediately(self):
        self.post("/api/auth/logout", self.first, expect=204)
        self.assertEqual(self.get(f"/api/incidents/{self.incident['id']}", self.second)["assignedAdmin"], "admin2")


if __name__ == "__main__":
    unittest.main()
