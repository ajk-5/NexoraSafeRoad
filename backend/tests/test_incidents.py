"""The AI pipeline's side of the API, and statistics."""
import unittest

from backend.tests.base import AI_HEADERS, ApiTestCase, ai_report


class AiReportTest(ApiTestCase):
    def test_accepts_the_ai_payload(self):
        incident = self.report(people=0, fire=True)
        self.assertEqual(incident["reference"], f"INC-{1000 + incident['id']}")
        self.assertEqual((incident["severity"], incident["vehicles"], incident["confidence"]), ("HIGH", 3, 0.87))
        self.assertTrue(incident["possibleInjuries"])
        self.assertEqual(incident["detectedAt"], "2026-10-17T10:24:00Z")
        self.assertEqual(
            incident["suggestedServices"][0], {"service": "POLICE", "reason": "Secure the scene and manage traffic"}
        )
        self.assertEqual(incident["selectedServices"], ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"])

    def test_requires_the_api_key(self):
        self.assertEqual(self.client.post("/api/incidents", json=ai_report()).status_code, 401)
        response = self.client.post("/api/incidents", json=ai_report(), headers={"X-API-Key": "wrong"})
        self.assertEqual(response.status_code, 401)

    def test_rejects_invalid_reports(self):
        for bad in [{"severity": "EXTREME"}, {"confidence": 1.5}, {"people": -1}, {"latitude": 123}]:
            with self.subTest(bad):
                response = self.client.post("/api/incidents", json=ai_report(**bad), headers=AI_HEADERS)
                self.assertEqual(response.status_code, 422)

    def test_video_upload(self):
        incident = self.report()
        clip = b"\x00\x00\x00\x18ftypmp42 fake clip"
        response = self.client.put(
            f"/api/incidents/{incident['id']}/video",
            content=clip,
            headers={**AI_HEADERS, "Content-Type": "video/mp4"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["videoUrl"], f"/media/{incident['reference']}.mp4")
        self.assertEqual((self.media_dir / f"{incident['reference']}.mp4").read_bytes(), clip)

        no_key = self.client.put(f"/api/incidents/{incident['id']}/video", content=clip, headers={"Content-Type": "video/mp4"})
        self.assertEqual(no_key.status_code, 401)


class StatisticsTest(ApiTestCase):
    def test_counts(self):
        admin = self.login("admin1")
        first = self.report(severity="HIGH")
        self.report(severity="LOW", camera_id="cam-02")
        self.post(f"/api/incidents/{first['id']}/send", admin, {"services": ["POLICE", "AMBULANCE"]})

        stats = self.get("/api/statistics", admin)
        self.assertEqual(stats["totalIncidents"], 2)
        self.assertEqual(stats["incidentsBySeverity"], {"LOW": 1, "MEDIUM": 0, "HIGH": 1})
        self.assertEqual(stats["incidentsByStatus"]["ALERT_SENT"], 1)
        self.assertEqual(stats["incidentsByStatus"]["ASSIGNED"], 1)  # the second one went to admin1 after sending
        self.assertEqual(stats["incidentsByCamera"], {"cam-01": 1, "cam-02": 1})
        self.assertEqual(stats["alertsByService"], {"POLICE": 1, "AMBULANCE": 1, "POMPIERS": 0, "DEPANNAGE": 0})
        self.assertEqual(len(stats["incidentsPerDay"]), 7)
        self.assertIsNone(stats["averageResponseSeconds"])
        self.assertEqual(stats["operatorsByStatus"]["BUSY"], 1)


if __name__ == "__main__":
    unittest.main()
