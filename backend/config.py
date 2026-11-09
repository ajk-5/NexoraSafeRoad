"""Settings, read from environment variables. Defaults are for local development."""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_DIR / ".env", override=False)

BACKEND_DIR = Path(__file__).resolve().parent

# PostgreSQL credentials are supplied by the deployment environment / Docker Compose.
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'saferoad.db'}")

# Incident clips uploaded by the AI, served under /media.
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", BACKEND_DIR / "media"))

# Shared secret the AI pipeline sends in the X-API-Key header to report incidents.
AI_API_KEY = os.environ.get("AI_API_KEY", "")

OFFLINE_TIMEOUT = int(os.environ.get("OFFLINE_TIMEOUT", 120))  # seconds without a heartbeat
LOCK_TIMEOUT = int(os.environ.get("LOCK_TIMEOUT", 120))  # seconds without activity on a locked incident
SWEEP_INTERVAL = int(os.environ.get("SWEEP_INTERVAL", 10))  # seconds between timeout checks, 0 disables

# AI training platform: uploaded datasets and trained model weights.
TRAINING_DIR = Path(os.environ.get("TRAINING_DIR", BACKEND_DIR / "training_data"))
MAX_DATASET_MB = int(os.environ.get("MAX_DATASET_MB", 5000))
WORKER_TIMEOUT = int(os.environ.get("WORKER_TIMEOUT", 60))  # seconds without a training worker heartbeat

# Police, fire, hospital and tow stations suggested to admins (python -m backend.import_stations).
STATIONS_FILE = Path(os.environ.get("STATIONS_FILE", BACKEND_DIR / "data" / "stations.json"))

# Creates the demo accounts listed in backend/README.md when the database is empty.
SEED_DEMO_OPERATORS = os.environ.get("SEED_DEMO_OPERATORS", "0") == "1"
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
