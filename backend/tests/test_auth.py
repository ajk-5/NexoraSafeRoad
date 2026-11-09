import unittest

from backend.models import Role
from backend.tests.base import PASSWORD, ApiTestCase


class AuthTest(ApiTestCase):
    def test_login_makes_the_operator_active(self):
        headers = self.login("police1", Role.POLICE)
        me = self.me(headers)
        self.assertEqual((me["username"], me["role"], me["status"]), ("police1", "POLICE", "ACTIVE"))

    def test_client_supplied_role_cannot_change_the_stored_role(self):
        self.add_operator("police1", Role.POLICE)
        response = self.client.post("/api/auth/login", json={"role": "ADMIN", "username": "police1", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["operator"]["role"], "POLICE")

    def test_login_discovers_every_role_without_a_role_field(self):
        for role in Role:
            with self.subTest(role=role):
                username = f"user_{role.value.lower()}"
                self.add_operator(username, role)
                response = self.client.post("/api/auth/login", json={"username": username.upper(), "password": PASSWORD})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["operator"]["role"], role.value)

    def test_unknown_account_and_bad_password_return_the_same_error(self):
        self.add_operator("admin", Role.ADMIN)
        unknown = self.client.post("/api/auth/login", json={"username": "unknown", "password": "wrong"})
        wrong = self.client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        self.assertEqual((unknown.status_code, unknown.json()), (wrong.status_code, wrong.json()))

    def test_password_change_rotates_the_token_and_preserves_role(self):
        headers = self.login("admin")
        password = "Three otters cross a river!"
        updated = self.post("/api/auth/password", headers, {"currentPassword": PASSWORD, "newPassword": password})
        self.assertEqual(updated["operator"]["role"], "ADMIN")
        self.assertEqual(self.client.get("/api/operators/me", headers=headers).status_code, 401)
        self.assertEqual(self.client.get("/api/operators/me", headers={"Authorization": f"Bearer {updated['token']}"}).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"username": "admin", "password": password}).status_code, 200)

    def test_wrong_current_password_does_not_end_the_session(self):
        headers = self.login("admin")
        self.post("/api/auth/password", headers, {"currentPassword": "wrong", "newPassword": "Three otters cross a river!"}, expect=403)
        self.me(headers)

    def test_password_change_rejects_weak_values_without_echoing_passwords(self):
        headers = self.login("admin")
        for password in ("short", "passwordpassword", "a" * 20, "abcd" * 5, "x" * 129):
            with self.subTest(password=password):
                response = self.client.post("/api/auth/password", headers=headers, json={"currentPassword": PASSWORD, "newPassword": password})
                self.assertEqual(response.status_code, 422)
                self.assertNotIn(password, response.text)

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
