"""Local copies of the models registered on the backend (admin "AI Training" page).

Model files are pickles, which run code when loaded, so every file is checked against
the sha256 the backend recorded before it is used.
"""
from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Any

from . import download_models
from .backend_client import BackendClient, BackendError

TRAINED_DIR = download_models.MODEL_DIR / "trained"


def local_model(client: BackendClient, info: Mapping[str, Any]) -> Path:
    """The file for a backend model description (`ModelInfo`), downloading it if needed."""
    checksum = str(info["sha256"])
    if info["source"] == "PRETRAINED":
        name = download_models.name_for(checksum)
        if name is None:
            raise BackendError(f"Unknown pretrained model {info['name']!r}: add it to ai/download_models.py.")
        return download_models.ensure(name)

    path = TRAINED_DIR / f"{checksum}.pt"
    if path.exists() and download_models.sha256(path) == checksum:
        return path
    download_path = info.get("downloadPath")
    if not download_path:
        raise BackendError(f"The backend has no file for model {info['name']!r}.")
    partial = path.with_name(f"{path.name}.download")
    client.download(str(download_path), partial)
    if download_models.sha256(partial) != checksum:
        partial.unlink()
        raise BackendError(f"Model {info['name']!r} failed its checksum check, download discarded.")
    partial.replace(path)
    return path
