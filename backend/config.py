"""Settings, read from environment variables. Defaults are for local development."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent

# PostgreSQL in Docker, e.g. postgresql+psycopg://saferoad:saferoad@db:5432/saferoad
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'saferoad.db'}")

# Incident clips uploaded by the AI, served under /media.
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", BACKEND_DIR / "media"))

# Shared secret the AI pipeline sends in the X-API-Key header to report incidents.
AI_API_KEY = os.environ.get("AI_API_KEY", "dev-ai-key")

OFFLINE_TIMEOUT = int(os.environ.get("OFFLINE_TIMEOUT", 120))  # seconds without a heartbeat
LOCK_TIMEOUT = int(os.environ.get("LOCK_TIMEOUT", 120))  # seconds without activity on a locked incident
SWEEP_INTERVAL = int(os.environ.get("SWEEP_INTERVAL", 10))  # seconds between timeout checks, 0 disables

# Creates the demo accounts listed in backend/README.md when the database is empty.
SEED_DEMO_OPERATORS = os.environ.get("SEED_DEMO_OPERATORS", "1") == "1"

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
