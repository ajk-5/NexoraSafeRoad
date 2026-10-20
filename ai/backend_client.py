"""Calls from the AI side (detector, training worker) to the backend API, with its X-API-Key."""
from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import IO, Any


class BackendError(Exception):
    """The backend refused the request or could not be reached."""


class BackendClient:
    def __init__(self, base_url: str, api_key: str, timeout: float = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def get(self, path: str, params: dict[str, str] | None = None) -> Any:
        with self._open("GET", path, params=params) as response:
            return _json(response.read())

    def post(self, path: str, payload: object) -> Any:
        body = json.dumps(payload).encode()
        with self._open("POST", path, body=body, content_type="application/json") as response:
            return _json(response.read())

    def put_file(self, path: str, file: Path, content_type: str, params: dict[str, str] | None = None) -> Any:
        """Upload a file as the raw request body, streamed from disk."""
        with file.open("rb") as body:
            size = file.stat().st_size
            with self._open("PUT", path, body=body, content_type=content_type, length=size, params=params) as response:
                return _json(response.read())

    def download(self, path: str, target: Path) -> None:
        """Stream a file to `target` (written under a temporary name until complete)."""
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(f"{target.name}.part")
        with self._open("GET", path) as response, partial.open("wb") as out:
            shutil.copyfileobj(response, out, 1 << 20)
        partial.replace(target)

    def _open(
        self,
        method: str,
        path: str,
        body: bytes | IO[bytes] | None = None,
        content_type: str | None = None,
        length: int | None = None,
        params: dict[str, str] | None = None,
    ) -> Any:
        url = self.base_url + path + (f"?{urllib.parse.urlencode(params)}" if params else "")
        headers = {"X-API-Key": self.api_key}
        if content_type:
            headers["Content-Type"] = content_type
        if length is not None:
            headers["Content-Length"] = str(length)
        request = urllib.request.Request(url, data=body, method=method, headers=headers)
        try:
            return urllib.request.urlopen(request, timeout=self.timeout)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:500]
            raise BackendError(f"{method} {path} failed with {exc.code}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise BackendError(f"{method} {path} failed: {exc}") from exc


def _json(raw: bytes) -> Any:
    return json.loads(raw) if raw else None
