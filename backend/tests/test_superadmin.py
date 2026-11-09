"""The super admin: runs the platform (accounts, AI training, statistics) but never reviews incidents."""
import unittest

from sqlalchemy import select
from unittest import mock

from backend import config
from backend.models import Operator, Role
from backend.seed import seed_demo_operators
from backend.tests.base import ApiTestCase

NEW_ACCOUNT = {"username": "police2", "displayName": "Police Operator 02", "role": "POLICE", "password": "Three otters cross a river!"}


class PermissionsTest(ApiTestCase):
    def test_only_the_superadmin_sees_statistics_training_and_accounts(self):
        superadmin = self.login("superadmin", Role.SUPERADMIN)
        admin = self.login("admin1")
        police = self.login("police1", Role.POLICE)
        for path in ["/api/statistics", "/api/training/overview", "/api/training/models", "/api/operators"]:
            with self.subTest(path):
                self.get(path, superadmin)
                for headers in (admin, police):
                    response = self.client.get(path, headers=headers)
                    self.assertEqual(response.status_code, 403, response.text)
                    self.assertEqual(response.json()["error"], "SUPERADMIN_ONLY")

    def test_the_superadmin_cannot_review_or_accept(self):
        superadmin = self.login("superadmin", Role.SUPERADMIN)
        self.login("admin1")
        incident = self.report()
        for action, body in [("review", None), ("confirm", None), ("send", {"services": ["POLICE"]}), ("decline", None)]:
            with self.subTest(action):
                error = self.post(f"/api/incidents/{incident['id']}/{action}", superadmin, body, expect=403)
                self.assertEqual(error["error"], "ADMIN_ONLY")

    def test_the_superadmin_is_never_assigned_incidents(self):
        superadmin = self.login("superadmin", Role.SUPERADMIN)
        self.assertEqual(self.report()["status"], "WAITING_FOR_OPERATOR")
        me = self.me(superadmin)
        self.assertEqual((me["status"], me["currentIncidentId"]), ("ACTIVE", None))

    def test_the_superadmin_sees_every_incident_and_alert_read_only(self):
        superadmin = self.login("superadmin", Role.SUPERADMIN)
        admin = self.login("admin1")
        sent = self.report()
        self.post(f"/api/incidents/{sent['id']}/send", admin, {"services": ["AMBULANCE"]})
        other = self.report()

        incidents = self.get("/api/incidents", superadmin)
        self.assertEqual({i["id"] for i in incidents}, {sent["id"], other["id"]})
        self.assertFalse(any(i["canEdit"] for i in incidents))
        alerts = self.get("/api/alerts", superadmin)
        self.assertEqual([(a["serviceType"], a["canAccept"]) for a in alerts], [("AMBULANCE", False)])


class AccountsTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.superadmin = self.login("superadmin", Role.SUPERADMIN)

    def test_creates_an_account_that_can_sign_in(self):
        created = self.post("/api/operators", self.superadmin, NEW_ACCOUNT, expect=201)
        self.assertEqual((created["username"], created["displayName"], created["role"], created["status"]), ("police2", "Police Operator 02", "POLICE", "OFFLINE"))
        response = self.client.post("/api/auth/login", json={"username": "police2", "password": NEW_ACCOUNT["password"]})
        self.assertEqual(response.status_code, 200, response.text)

    def test_usernames_are_unique_whatever_the_case(self):
        self.post("/api/operators", self.superadmin, NEW_ACCOUNT, expect=201)
        error = self.post("/api/operators", self.superadmin, {**NEW_ACCOUNT, "username": "POLICE2"}, expect=409)
        self.assertEqual(error["error"], "USERNAME_TAKEN")

    def test_rejects_invalid_accounts(self):
        for bad in [{"password": "short"}, {"password": "passwordpassword"}, {"password": "a" * 20}, {"password": "x" * 129}, {"username": "no spaces"}, {"username": "ab"}, {"role": "KING"}, {"displayName": ""}]:
            with self.subTest(bad):
                self.post("/api/operators", self.superadmin, {**NEW_ACCOUNT, **bad}, expect=422)

    def test_admins_and_service_operators_cannot_create_accounts(self):
        for headers in (self.login("admin1"), self.login("police1", Role.POLICE)):
            self.post("/api/operators", headers, NEW_ACCOUNT, expect=403)


class SeedTest(ApiTestCase):
    def test_an_existing_database_gets_the_demo_superadmin(self):
        self.add_operator("admin1", Role.ADMIN)  # created before the role existed
        with self.Session() as db, mock.patch.object(config, "DEMO_PASSWORD", NEW_ACCOUNT["password"]):
            seed_demo_operators(db)
            seed_demo_operators(db)  # only once
            superadmins = db.scalars(select(Operator).where(Operator.role == Role.SUPERADMIN)).all()
        self.assertEqual([o.username for o in superadmins], ["superadmin"])
        response = self.client.post("/api/auth/login", json={"username": "superadmin", "password": NEW_ACCOUNT["password"]})
        self.assertEqual(response.status_code, 200, response.text)


if __name__ == "__main__":
    unittest.main()
