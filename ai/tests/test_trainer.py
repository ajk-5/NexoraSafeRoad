import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path
from typing import Any, cast

HAS_DEPS = all(importlib.util.find_spec(m) for m in ("cv2", "yaml", "numpy"))


@unittest.skipUnless(HAS_DEPS, "opencv-python / pyyaml not installed")
class DatasetExtractionTest(unittest.TestCase):
    def test_place_member_accepts_only_dataset_files(self):
        from ai.trainer import place_member

        root = ("Crash-1",)
        self.assertEqual(place_member("Crash-1/train/images/a.jpg", root), ("train", "images", "a.jpg"))
        self.assertEqual(place_member("Crash-1/valid/labels/a.txt", root), ("val", "labels", "a.txt"))
        for member in [
            "Crash-1/data.yaml",  # we write our own
            "Crash-1/train/images/run.py",
            "Crash-1/train/labels/a.jpg",
            "Crash-1/other/images/a.jpg",
            "Crash-1/train/images/sub/a.jpg",
            "Other/train/images/a.jpg",
            "Crash-1/train/images/..\\..\\..\\evil.jpg",  # a Windows path escape
            "Crash-1/train/images/C:evil.jpg",
            "../train/images/a.jpg",
        ]:
            with self.subTest(member):
                self.assertIsNone(place_member(member, root))

    def test_extract_writes_nothing_outside_the_target(self):
        from ai.trainer import extract_dataset

        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "dataset.zip"
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr("ds/data.yaml", "names: [accident]\ndownload: python -c 'import os'\n")
                z.writestr("ds/train/images/a.jpg", b"img")
                z.writestr("ds/train/labels/a.txt", "0 0.5 0.5 0.1 0.1")
                z.writestr("ds/valid/images/b.jpg", b"img")
                z.writestr("ds/train/images/..\\..\\evil.jpg", b"evil")
                z.writestr("ds/../../escape.txt", b"evil")
                z.writestr("ds/train/images/script.sh", b"evil")
            target = Path(tmp) / "out"
            counts = extract_dataset(archive, target)

            self.assertEqual(counts, {"train": 1, "val": 1})
            written = sorted(p.relative_to(target).as_posix() for p in target.rglob("*") if p.is_file())
            self.assertEqual(written, ["train/images/a.jpg", "train/labels/a.txt", "val/images/b.jpg"])
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["dataset.zip", "out"])

    def test_extract_stops_at_the_size_limit(self):
        from ai.trainer import extract_dataset

        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "dataset.zip"
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
                z.writestr("train/images/big.jpg", b"0" * 10_000)
            with self.assertRaises(ValueError):
                extract_dataset(archive, Path(tmp) / "out", max_bytes=1_000)

    def test_data_yaml_is_ours(self):
        import yaml

        from ai.trainer import write_data_yaml

        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            (data_dir / "test" / "images").mkdir(parents=True)
            config = yaml.safe_load(write_data_yaml(data_dir, ["accident", "vehicle"]).read_text())
            self.assertNotIn("download", config)
            self.assertEqual(config["names"], {0: "accident", 1: "vehicle"})
            self.assertEqual((config["train"], config["val"], config["test"]), ("train/images", "val/images", "test/images"))
            self.assertTrue(Path(config["path"]).is_absolute())


@unittest.skipUnless(HAS_DEPS, "opencv-python / pyyaml not installed")
class LabelTest(unittest.TestCase):
    def test_yolo_label_is_relative_and_clamped(self):
        from ai.trainer import yolo_label

        self.assertEqual(yolo_label(0, (100, 50, 300, 150), 400, 200), "0 0.500000 0.500000 0.500000 0.500000")
        self.assertEqual(yolo_label(2, (-10, 0, 450, 200), 400, 200), "2 0.500000 0.500000 1.000000 1.000000")

    def test_accident_class(self):
        from ai.trainer import accident_class_id

        self.assertEqual(accident_class_id(["vehicle", "Crash"]), 1)
        self.assertIsNone(accident_class_id(["vehicle", "person"]))


class FakeTrainer:
    def __init__(self, epochs: int):
        self.epoch, self.epochs, self.stop = 0, epochs, False
        self.metrics: dict[str, Any] | None = {"metrics/mAP50(B)": 0.5, "metrics/precision(B)": 0.6}
        self.tloss: Any = {"box_loss": 1.25}

    def label_loss_items(self, loss_items: Any = None, prefix: str = "train") -> Any:
        return {f"{prefix}/{k}": v for k, v in loss_items.items()}


class FakeClient:
    def __init__(self, cancel_after: int | None = None):
        self.reports: list[dict[str, Any]] = []
        self.cancel_after = cancel_after

    def post(self, path: str, payload: object) -> Any:
        assert isinstance(payload, dict)
        self.reports.append(cast("dict[str, Any]", payload))
        epochs = [r["metrics"]["epoch"] for r in self.reports if not r["final"]]
        return {"cancelRequested": self.cancel_after is not None and len(epochs) >= self.cancel_after}


@unittest.skipUnless(HAS_DEPS, "opencv-python / pyyaml not installed")
class ProgressReporterTest(unittest.TestCase):
    def run_training(self, client: FakeClient, epochs: int) -> tuple[Any, FakeTrainer]:
        from ai.trainer import LogBuffer, ProgressReporter

        reporter = ProgressReporter(client, 7, "gpu-box", LogBuffer())
        trainer = FakeTrainer(epochs)
        # What ultralytics does: train + validate each epoch, then validate best.pt once more.
        for epoch in range(epochs):
            trainer.epoch = epoch
            reporter.on_train_epoch_end(trainer)
            reporter.on_fit_epoch_end(trainer)
            if trainer.stop:
                break
        trainer.epoch += 1
        reporter.on_fit_epoch_end(trainer)
        return reporter, trainer

    def test_reports_each_epoch_then_the_final_metrics(self):
        client = FakeClient()
        self.run_training(client, epochs=3)
        self.assertEqual([(r["metrics"]["epoch"], r["final"]) for r in client.reports], [(1, False), (2, False), (3, False), (3, True)])
        first = client.reports[0]["metrics"]
        self.assertEqual((first["map50"], first["precision"], first["box_loss"], first["recall"]), (0.5, 0.6, 1.25, None))

    def test_cancel_stops_after_the_current_epoch(self):
        client = FakeClient(cancel_after=2)
        reporter, trainer = self.run_training(client, epochs=10)
        self.assertTrue(reporter.cancelled and trainer.stop)
        self.assertEqual([r["metrics"]["epoch"] for r in client.reports if not r["final"]], [1, 2])


if __name__ == "__main__":
    unittest.main()
