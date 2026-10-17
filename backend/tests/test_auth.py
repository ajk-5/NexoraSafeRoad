import unittest

from backend.models import Role
from backend.tests.base import PASSWORD, ApiTestCase


class AuthTest(ApiTestCase):
    def test_login_makes_the_operator_active(self):
        headers = self.login("police1", Role.POLICE)
        me = self.me(headers)
        self.assertEqual((me["username"], me["role"], me["status"]), ("police1", "POLICE", "ACTIVE"))

    def test_login_with_the_wrong_role_is_rejected(self):
        self.add_operator("police1", Role.POLICE)
        response = self.client.post("/api/auth/login", json={"role": "ADMIN", "username": "police1", "password": PASSWORD})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "INVALID_CREDENTIALS")

    def test_login_with_the_wrong_password_is_rejected(self):
        self.add_operator("admin1", Role.ADMIN)
        response = self.client.post("/api/auth/login", json={"role": "ADMIN", "username": "admin1", "password": "nope"})
        self.assertEqual(response.status_code, 401)

    def test_requests_need_a_valid_token(self):
        self.assertEqual(self.client.get("/api/operators/me").status_code, 401)
        self.assertEqual(self.client.get("/api/operators/me", headers={"Authorization": "Bearer junk"}).status_code, 401)

    def test_logout_ends_the_session(self):
        headers = self.login("admin1")
        self.post("/api/auth/logout", headers, expect=204)
        self.assertEqual(self.client.get("/api/operators/me", headers=headers).status_code, 401)

    def test_service_operators_cannot_use_admin_endpoints(self):
        headers = self.login("police1", Role.POLICE)
        self.assertEqual(self.client.get("/api/statistics", headers=headers).status_code, 403)
        incident = self.report()
        response = self.client.post(f"/api/incidents/{incident['id']}/decline", headers=headers)
        self.assertEqual(response.status_code, 403)

    def test_pause_and_resume(self):
        headers = self.login("admin1")
        self.assertEqual(self.post("/api/operators/pause", headers)["status"], "PAUSED")
        self.post("/api/operators/pause", headers, expect=409)
        self.assertEqual(self.post("/api/operators/resume", headers)["status"], "ACTIVE")


if __name__ == "__main__":
    unittest.main()
