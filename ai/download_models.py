"""Download the pretrained models into ai/model/ (they are too big for git).

    python -m ai.download_models

The COCO object model (yolo11n.pt) is downloaded by ultralytics on first use.
"""
from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent / "model"

# name -> (url pinned to a commit, sha256). Checkpoints are pickles, which run code when
# loaded, so the checksum guarantees we load exactly the file that was reviewed.
MODELS = {
    # YOLO11x fine-tuned on Roboflow "Traffic Accident Detection" (classes: accident, vehicle).
    # MIT license: https://huggingface.co/Enos-123/traffic-accident-detection-yolo11x
    "accident_model.pt": (
        "https://huggingface.co/Enos-123/traffic-accident-detection-yolo11x/resolve/"
        "cdc556d278e00273fc3af373051b0df2fb7c7f1e/weights/epoch61.pt",
        "ea56e358905e79e1451170e699b21ad774ca95e12034ae1ab1f7d09fd3619cae",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(name: str, url: str, expected: str) -> None:
    target = MODEL_DIR / name
    if target.exists() and sha256(target) == expected:
        print(f"{name}: already downloaded")
        return
    partial = target.with_name(f"{name}.part")
    print(f"{name}: downloading {url}")
    urllib.request.urlretrieve(url, partial)
    if sha256(partial) != expected:
        partial.unlink()
        raise RuntimeError(f"{name}: checksum mismatch, download discarded")
    partial.replace(target)
    print(f"{name}: saved to {target}")


def ensure(name: str) -> Path:
    """The local path of a pinned model, downloaded first if needed."""
    url, expected = MODELS[name]
    MODEL_DIR.mkdir(exist_ok=True)
    download(name, url, expected)
    return MODEL_DIR / name


def name_for(checksum: str) -> str | None:
    """Which pinned model has this sha256 (how the backend refers to pretrained models)."""
    return next((name for name, (_, expected) in MODELS.items() if expected == checksum), None)


def main() -> None:
    for name in MODELS:
        ensure(name)


if __name__ == "__main__":
    main()
