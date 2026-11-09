from unittest import mock

from starlette.websockets import WebSocketDisconnect

from backend.models import Role
from backend.routes import live
from .base import ApiTestCase


class LiveTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch.object(live, "SessionLocal", self.Session)
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = mock.patch.object(live, "CHECK_INTERVAL", 0.02)
        patcher.start()
        self.addCleanup(patcher.stop)

    def token(self, headers):
        return headers["Authorization"].split()[1]

    def test_invalid_token_is_rejected(self):
        with self.client.websocket_connect("/api/live") as socket:
            socket.send_json({"token": "invalid"})
            with self.assertRaises(WebSocketDisconnect) as closed:
                socket.receive_json()
            self.assertEqual(closed.exception.code, 1008)

    def test_untrusted_origin_is_rejected(self):
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect("/api/live", headers={"origin": "https://untrusted.example"}):
                pass

    def test_changes_and_revocation_are_observed(self):
        admin = self.login("admin")
        with self.client.websocket_connect("/api/live") as socket:
            socket.send_json({"token": self.token(admin)})
            self.assertEqual(socket.receive_json(), {"type": "changed"})
            self.assertEqual(socket.receive_json(), {"type": "ping"})
            self.report()
            for _ in range(50):
                if socket.receive_json()["type"] == "changed":
                    break
            else:
                self.fail("Incident was not announced")
            self.post("/api/auth/logout", admin, expect=204)
            with self.assertRaises(WebSocketDisconnect) as closed:
                for _ in range(50):
                    socket.receive_json()
            self.assertEqual(closed.exception.code, 1008)

    def test_change_detection_respects_service_visibility(self):
        admin = self.login("admin")
        police = self.login("police", Role.POLICE)
        fire = self.login("fire", Role.POMPIERS)
        police_before = live.fingerprint(self.token(police))
        fire_before = live.fingerprint(self.token(fire))
        incident = self.report()
        self.assertEqual(live.fingerprint(self.token(police)), police_before)
        self.post(f"/api/incidents/{incident['id']}/review", admin)
        self.post(f"/api/incidents/{incident['id']}/send", admin, {"services": ["POLICE"]})
        self.assertNotEqual(live.fingerprint(self.token(police)), police_before)
        self.assertEqual(live.fingerprint(self.token(fire)), fire_before)
