"""Nearest stations: suggested to the admin, recorded on each alert sent."""
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest import mock

from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from backend import config
from backend.database import Base, add_missing_columns, make_engine
from backend.models import Incident, IncidentStatus, Role, Severity
from backend.services import station_service
from backend.tests.base import ApiTestCase


class NearestStationsTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.login("admin1")
        self.incident = self.report()  # at the default camera position, assigned to admin1

    def stations(self) -> dict[str, list[dict[str, Any]]]:
        listing = self.get(f"/api/incidents/{self.incident['id']}/stations", self.admin)
        return {entry["service"]: entry["stations"] for entry in listing}

    def send(self, services: list[str], stations: dict[str, str] | None = None, expect: int = 200) -> dict[str, Any]:
        body: dict[str, Any] = {"services": services, "stations": stations or {}}
        return self.post(f"/api/incidents/{self.incident['id']}/send", self.admin, body, expect=expect)

    def test_lists_the_three_nearest_stations_of_each_service(self):
        stations = self.stations()
        self.assertEqual(list(stations), ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"])
        police = stations["POLICE"]
        self.assertEqual([s["id"] for s in police], ["test:police-near", "test:police-mid", "test:police-far"])
        self.assertEqual(police, sorted(police, key=lambda s: s["distanceM"]))
        self.assertEqual(police[0]["name"], "Commissariat Near")
        self.assertEqual(police[0]["address"], "1 Rue A, 75004 Paris")
        self.assertGreater(police[0]["etaMinutes"], 0)
        self.assertEqual(stations["DEPANNAGE"], [])  # none in the test data

    def test_only_admins_choose_stations(self):
        police = self.login("police1", Role.POLICE)
        response = self.client.get(f"/api/incidents/{self.incident['id']}/stations", headers=police)
        self.assertEqual(response.status_code, 403)

    def test_each_service_is_sent_from_its_nearest_station_by_default(self):
        sent = self.send(["POLICE", "AMBULANCE", "DEPANNAGE"])
        stations = {a["serviceType"]: a["station"] for a in sent["alerts"]}
        self.assertEqual(stations["POLICE"]["id"], "test:police-near")
        self.assertEqual(stations["AMBULANCE"]["name"], "Hôpital Test")
        self.assertIsNone(stations["DEPANNAGE"])  # no station data: the alert still goes out
        self.assertEqual(sent["selectedStations"], {"POLICE": "test:police-near", "AMBULANCE": "test:hospital"})

        # The service operator sees where the response comes from.
        police = self.login("police1", Role.POLICE)
        [alert] = self.get("/api/alerts", police)
        self.assertEqual(alert["station"]["name"], "Commissariat Near")
        self.assertEqual(alert["station"]["distanceM"], self.stations()["POLICE"][0]["distanceM"])

    def test_admin_can_pick_another_station_and_keep_it_in_the_draft(self):
        draft = self.post(
            f"/api/incidents/{self.incident['id']}/draft",
            self.admin,
            # A station for a service that is not selected is dropped.
            {"services": ["POLICE"], "stations": {"POLICE": "test:police-mid", "POMPIERS": "test:fire-far"}},
        )
        self.assertEqual(draft["selectedStations"], {"POLICE": "test:police-mid"})

        sent = self.send(["POLICE", "POMPIERS"], draft["selectedStations"])
        stations = {a["serviceType"]: a["station"]["id"] for a in sent["alerts"]}
        self.assertEqual(stations, {"POLICE": "test:police-mid", "POMPIERS": "test:fire-near"})

    def test_rejects_unknown_stations_and_stations_of_another_service(self):
        for station in ("test:hospital", "osm:n0"):
            with self.subTest(station):
                error = self.send(["POLICE"], {"POLICE": station}, expect=400)
                self.assertEqual(error["error"], "UNKNOWN_STATION")
        incident = self.get(f"/api/incidents/{self.incident['id']}", self.admin)
        self.assertEqual((incident["status"], incident["alerts"]), ("ASSIGNED", []))

    def test_works_without_station_data(self):
        with (
            mock.patch.object(config, "STATIONS_FILE", Path(self.media_dir) / "missing.json"),
            self.assertLogs("saferoad.backend", "WARNING"),
        ):
            self.assertEqual(self.stations()["POLICE"], [])
            sent = self.send(["POLICE"])
        self.assertIsNone(sent["alerts"][0]["station"])


class DistanceTest(unittest.TestCase):
    def test_distance(self):
        # One degree of latitude is about 111.2 km.
        self.assertAlmostEqual(station_service.distance_m(48.0, 2.0, 49.0, 2.0), 111_195, delta=10)
        self.assertEqual(station_service.distance_m(48.8566, 2.3522, 48.8566, 2.3522), 0)

    def test_eta_is_a_rough_estimate_of_at_least_a_minute(self):
        self.assertEqual(station_service.eta_minutes(0), 1)
        self.assertEqual(station_service.eta_minutes(1000), 3)  # 1.4 km of road at 35 km/h = 2.4 min
        self.assertEqual(station_service.eta_minutes(10_000), 24)


class AddMissingColumnsTest(unittest.TestCase):
    def test_adds_new_columns_to_an_existing_database_and_keeps_its_rows(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        engine = make_engine(f"sqlite:///{Path(folder.name) / 'old.db'}")
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            db.add(
                Incident(
                    camera_id="cam-01",
                    latitude=48.8566,
                    longitude=2.3522,
                    severity=Severity.HIGH,
                    confidence=0.9,
                    vehicles=2,
                    people=0,
                    detected_at=datetime.now(timezone.utc),
                    status=IncidentStatus.WAITING_FOR_OPERATOR,
                )
            )
            db.commit()
        # A database created before the station columns existed.
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE incidents DROP COLUMN selected_stations"))
            connection.execute(text("ALTER TABLE alerts DROP COLUMN station_name"))

        add_missing_columns(engine)
        add_missing_columns(engine)  # nothing left to add the second time

        columns = inspect(engine)
        self.assertIn("selected_stations", {c["name"] for c in columns.get_columns("incidents")})
        self.assertIn("station_name", {c["name"] for c in columns.get_columns("alerts")})
        with Session(engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Incident)), 1)
            self.assertEqual(db.scalars(select(Incident)).one().selected_stations, None)


if __name__ == "__main__":
    unittest.main()
