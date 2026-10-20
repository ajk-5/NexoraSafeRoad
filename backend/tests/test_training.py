"""The AI training platform: datasets, models, jobs and the training worker protocol."""
import hashlib
import io
import unittest
import zipfile
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from backend import config
from backend.database import utcnow
from backend.models import Role
from backend.seed import seed_model_registry
from backend.services import training_service
from backend.tests.base import AI_HEADERS, ApiTestCase, Headers

WORKER = {"name": "gpu-box", "device": "Test GPU"}


def dataset_zip(
    names: Sequence[str] | dict[int, str] = ("accident", "vehicle"), root: str = "Crash-Dataset-1/", val: bool = True
) -> bytes:
    """A small Roboflow-style YOLO export."""
    files = {
        f"{root}data.yaml": f"names: {list(names) if not isinstance(names, dict) else names}\nnc: 2\ndownload: rm -rf /\n",
        f"{root}train/images/a.jpg": "jpg",
        f"{root}train/images/b.png": "png",
        f"{root}train/labels/a.txt": "0 0.5 0.5 0.2 0.2",
        f"{root}test/images/c.jpg": "jpg",
        f"{root}README.roboflow.txt": "readme",
    }
    if val:
        files[f"{root}valid/images/d.jpg"] = "jpg"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


class TrainingTestCase(ApiTestCase):
    def setUp(self):
        super().setUp()
        with self.Session() as db:
            seed_model_registry(db)
        self.admin = self.login("admin1")

    def upload(self, content: bytes, name: str = "Crashes", headers: Headers | None = None, expect: int = 201) -> Any:
        response = self.client.post(
            "/api/training/datasets",
            params={"name": name},
            content=content,
            headers={**(headers or self.admin), "Content-Type": "application/zip"},
        )
        self.assertEqual(response.status_code, expect, response.text)
        return response.json()

    def pretrained_id(self) -> int:
        return self.get("/api/training/models", self.admin)[0]["id"]

    def create_job(self, dataset_id: int, **overrides: Any) -> Any:
        body = {"datasetId": dataset_id, "baseCheckpoint": "yolo11n.pt", "epochs": 3, **overrides}
        return self.post("/api/training/jobs", self.admin, body, expect=201)

    def worker(self, path: str, json: dict[str, Any] | None = None, expect: int = 200) -> Any:
        response = self.client.post(f"/api/training/worker{path}", json=json, headers=AI_HEADERS)
        self.assertEqual(response.status_code, expect, response.text)
        return response.json() if response.content else None

    def progress(self, job_id: int, epoch: int, **extra: Any) -> Any:
        report = {"name": WORKER["name"], "metrics": {"epoch": epoch, "map50": 0.1 * epoch, "map50_95": 0.05 * epoch}}
        return self.worker(f"/jobs/{job_id}/progress", {**report, **extra})


class DatasetTest(TrainingTestCase):
    def test_upload_reads_the_yolo_layout(self):
        dataset = self.upload(dataset_zip())
        self.assertEqual(dataset["classNames"], ["accident", "vehicle"])
        self.assertEqual(dataset["detectorClasses"], ["accident"])
        self.assertEqual((dataset["trainImages"], dataset["valImages"], dataset["testImages"]), (2, 1, 1))
        self.assertTrue((config.TRAINING_DIR / "datasets" / f"dataset-{dataset['id']}.zip").exists())
        self.assertEqual([d["id"] for d in self.get("/api/training/datasets", self.admin)], [dataset["id"]])

    def test_class_names_can_be_a_mapping(self):
        dataset = self.upload(dataset_zip(names={0: "crash", 1: "fire"}, root=""))
        self.assertEqual(dataset["detectorClasses"], ["crash", "fire"])

    def test_rejects_invalid_datasets(self):
        cases = {
            "not a zip": b"hello",
            "no validation split": dataset_zip(val=False),
            "no class names": dataset_zip(names=()),
        }
        for case, content in cases.items():
            with self.subTest(case):
                error = self.upload(content, expect=400)
                self.assertEqual(error["error"], "INVALID_DATASET")
        self.assertEqual(self.get("/api/training/datasets", self.admin), [])
        self.assertEqual(list((config.TRAINING_DIR / "uploads").iterdir()), [])  # rejected uploads are deleted

    def test_admins_only(self):
        police = self.login("police1", Role.POLICE)
        self.upload(dataset_zip(), headers=police, expect=403)
        self.assertEqual(self.client.get("/api/training/overview").status_code, 401)
        self.assertEqual(self.client.post("/api/training/worker/claim", json=WORKER).status_code, 401)


class ModelTest(TrainingTestCase):
    def test_pretrained_model_is_registered_and_active(self):
        (model,) = self.get("/api/training/models", self.admin)
        self.assertEqual((model["source"], model["isActive"], model["map50"]), ("PRETRAINED", True, 0.826))
        active = self.client.get("/api/training/worker/models/active", headers=AI_HEADERS).json()
        self.assertEqual((active["id"], active["downloadPath"]), (model["id"], None))

    def test_job_validation(self):
        dataset = self.upload(dataset_zip(names=("vehicle", "person")))
        both ={"datasetId": dataset["id"], "baseCheckpoint": "yolo11n.pt", "baseModelId": self.pretrained_id()}
        self.post("/api/training/jobs", self.admin, both, expect=422)
        self.post("/api/training/jobs", self.admin, {"datasetId": dataset["id"], "baseCheckpoint": "evil.pt"}, expect=422)
        error = self.post(
            "/api/training/jobs", self.admin, {"datasetId": dataset["id"], "baseCheckpoint": "yolo11n.pt", "useConfirmed": True}, expect=400
        )
        self.assertEqual(error["error"], "NO_ACCIDENT_CLASS")


class TrainingJobTest(TrainingTestCase):
    def setUp(self):
        super().setUp()
        self.dataset = self.upload(dataset_zip())

    def test_a_queued_job_goes_to_one_worker(self):
        job = self.create_job(self.dataset["id"], baseModelId=self.pretrained_id(), baseCheckpoint=None)
        self.assertEqual((job["status"], job["baseName"]), ("QUEUED", "YOLO11x traffic accident (pretrained)"))

        claimed = self.worker("/claim", WORKER)
        self.assertEqual(claimed["id"], job["id"])
        self.assertEqual(claimed["dataset"]["classNames"], ["accident", "vehicle"])
        self.assertEqual(claimed["baseModel"]["source"], "PRETRAINED")
        self.assertIsNone(self.worker("/claim", {"name": "other-box"}))

        overview = self.get("/api/training/overview", self.admin)
        self.assertEqual((overview["runningJobs"], overview["worker"]["online"]), (1, True))
        archive = self.client.get(claimed["dataset"]["downloadPath"], headers=AI_HEADERS)
        self.assertEqual(archive.content, dataset_zip())

    def test_progress_completion_and_activation(self):
        job = self.create_job(self.dataset["id"])
        self.worker("/claim", WORKER)
        for epoch in (1, 2, 3):
            self.assertEqual(self.progress(job["id"], epoch, logLines=[f"epoch {epoch}"]), {"cancelRequested": False})
        self.progress(job["id"], 3, final=True, metrics={"epoch": 3, "map50": 0.91, "precision": 0.9, "recall": 0.8})

        weights = b"trained weights"
        response = self.client.put(
            f"/api/training/worker/jobs/{job['id']}/model",
            params={"name": WORKER["name"]},
            content=weights,
            headers={**AI_HEADERS, "Content-Type": "application/octet-stream"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        model = response.json()
        self.assertEqual(model["sha256"], hashlib.sha256(weights).hexdigest())

        detail = self.get(f"/api/training/jobs/{job['id']}", self.admin)
        self.assertEqual((detail["status"], detail["resultModelId"], detail["currentEpoch"]), ("COMPLETED", model["id"], 3))
        self.assertEqual([h["epoch"] for h in detail["history"]], [1, 2, 3])
        self.assertEqual(detail["finalMetrics"]["map50"], 0.91)
        self.assertIn("epoch 2", detail["log"])

        registered = next(m for m in self.get("/api/training/models", self.admin) if m["id"] == model["id"])
        self.assertEqual((registered["map50"], registered["isActive"]), (0.91, False))  # an admin decides
        self.post(f"/api/training/models/{model['id']}/activate", self.admin)
        active = [m["id"] for m in self.get("/api/training/models", self.admin) if m["isActive"]]
        self.assertEqual(active, [model["id"]])
        file = self.client.get(model["downloadPath"], headers=AI_HEADERS)
        self.assertEqual(file.content, weights)

    def test_cancelling(self):
        queued = self.create_job(self.dataset["id"])
        self.assertEqual(self.post(f"/api/training/jobs/{queued['id']}/cancel", self.admin)["status"], "CANCELLED")
        self.assertIsNone(self.worker("/claim", WORKER))

        running = self.create_job(self.dataset["id"])
        self.worker("/claim", WORKER)
        self.assertTrue(self.post(f"/api/training/jobs/{running['id']}/cancel", self.admin)["cancelRequested"])
        self.assertEqual(self.progress(running["id"], 1), {"cancelRequested": True})
        self.worker(f"/jobs/{running['id']}/end", {"name": WORKER["name"], "status": "CANCELLED"}, expect=204)
        self.assertEqual(self.get(f"/api/training/jobs/{running['id']}", self.admin)["status"], "CANCELLED")
        self.post(f"/api/training/jobs/{running['id']}/cancel", self.admin, expect=409)

    def test_only_the_claiming_worker_reports(self):
        job = self.create_job(self.dataset["id"])
        self.worker("/claim", WORKER)
        report = {"name": "other-box", "metrics": {"epoch": 1}}
        self.assertEqual(self.worker(f"/jobs/{job['id']}/progress", report, expect=409)["error"], "JOB_NOT_RUNNING_HERE")

    def test_a_silent_worker_fails_its_job(self):
        job = self.create_job(self.dataset["id"])
        self.worker("/claim", WORKER)
        with self.Session() as db:
            training_service.fail_stalled_jobs(db, utcnow() + timedelta(seconds=config.WORKER_TIMEOUT + 1))
            db.commit()
        detail = self.get(f"/api/training/jobs/{job['id']}", self.admin)
        self.assertEqual((detail["status"], detail["error"]), ("FAILED", "The training worker stopped responding."))


class FeedbackTest(TrainingTestCase):
    def test_reviewed_incidents_become_feedback(self):
        declined, sent, _waiting = (self.report() for _ in range(3))
        for incident in (declined, sent):
            self.client.put(
                f"/api/incidents/{incident['id']}/video", content=b"clip", headers={**AI_HEADERS, "Content-Type": "video/mp4"}
            )
        self.post(f"/api/incidents/{declined['id']}/decline", self.admin)
        self.post(f"/api/incidents/{sent['id']}/send", self.admin, {"services": ["POLICE"]})

        self.assertEqual(self.get("/api/training/overview", self.admin)["feedback"], {"falseAlarms": 1, "confirmed": 1})
        clips = self.client.get("/api/training/worker/feedback", params={"confirmed": True}, headers=AI_HEADERS).json()
        self.assertEqual(
            [(c["incidentId"], c["label"]) for c in clips], [(declined["id"], "false_alarm"), (sent["id"], "accident")]
        )


if __name__ == "__main__":
    unittest.main()
