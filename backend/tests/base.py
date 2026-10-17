import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import config
from backend.database import Base, get_db, make_engine
from backend.main import app
from backend.models import Operator, Role
from backend.security import hash_password

PASSWORD = "secret"
_PASSWORD_HASH = hash_password(PASSWORD)  # hashed once: scrypt is deliberately slow
AI_HEADERS = {"X-API-Key": config.AI_API_KEY}


def ai_report(**overrides) -> dict:
    """An incident exactly as ai/main.py `build_incident` sends it."""
    report = {
        "type": "traffic_accident",
        "camera_id": "cam-01",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "severity": "HIGH",
        "confidence": 0.87,
        "vehicles": 3,
        "people": 1,
        "fire": False,
        "overturned": False,
        "responders": ["police", "pompiers", "ambulance", "depannage"],
        "detected_at": "2026-10-17T10:24:00+00:00",
        "video_time": 12.4,
        "clip_path": "ai/output/cam-01_20261017_102400_f310.mp4",
    }
    report.update(overrides)
    return report


class ApiTestCase(unittest.TestCase):
    """Each test gets an empty in-memory database and a client without the background sweeper."""

    def setUp(self):
        engine = make_engine("sqlite://", poolclass=StaticPool)
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine, expire_on_commit=False)

        def test_db():
            with self.Session() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.addCleanup(app.dependency_overrides.clear)
        self.addCleanup(engine.dispose)

        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.media_dir = Path(media.name)
        patcher = mock.patch.object(config, "MEDIA_DIR", self.media_dir)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.client = TestClient(app)

    def add_operator(self, username: str, role: Role) -> int:
        with self.Session() as db:
            operator = Operator(username=username, display_name=username, role=role, password_hash=_PASSWORD_HASH)
            db.add(operator)
            db.commit()
            return operator.id

    def login(self, username: str, role: Role = Role.ADMIN) -> dict:
        """Create the operator, sign in, and return the auth headers."""
        self.add_operator(username, role)
        response = self.client.post("/api/auth/login", json={"role": role, "username": username, "password": PASSWORD})
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['token']}"}

    def report(self, **overrides) -> dict:
        response = self.client.post("/api/incidents", json=ai_report(**overrides), headers=AI_HEADERS)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def get(self, path: str, headers: dict) -> dict:
        response = self.client.get(path, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def post(self, path: str, headers: dict, json: dict | None = None, expect: int = 200) -> dict:
        response = self.client.post(path, headers=headers, json=json)
        self.assertEqual(response.status_code, expect, response.text)
        return response.json() if response.content else {}

    def me(self, headers: dict) -> dict:
        return self.get("/api/operators/me", headers)
