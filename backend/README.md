# Nexora SafeRoad — Backend

FastAPI + SQLAlchemy + PostgreSQL. Implements users and roles, operator availability,
incident assignment and locking, alerts and statistics described in the main [README](../README.md).

## Run it

With Docker (PostgreSQL included):

```bash
docker compose up --build        # API on http://localhost:8000, docs on /docs
```

Without Docker (SQLite file `backend/saferoad.db`), from the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate           # Windows   (source .venv/bin/activate elsewhere)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Tests:

```bash
python -m unittest discover -s backend/tests -t .
```

Then send incidents from the AI pipeline:

```bash
python -m ai.main --source dataset/videos/crash.mp4 --backend http://localhost:8000
```

## Demo accounts

Created on first start when the database is empty (turn off with `SEED_DEMO_OPERATORS=0`).
Password for all of them: `saferoad`.

| Role      | Usernames                    |
|-----------|------------------------------|
| ADMIN     | `admin1`, `admin2`, `admin3` |
| POLICE    | `police1`                    |
| AMBULANCE | `ambulance1`                 |
| POMPIERS  | `pompiers1`                  |
| DEPANNAGE | `depannage1`                 |

## Settings (environment variables)

| Variable              | Default                   | Meaning                                         |
|-----------------------|---------------------------|-------------------------------------------------|
| `DATABASE_URL`        | `sqlite:///backend/saferoad.db` | e.g. `postgresql+psycopg://user:pw@host/db` |
| `AI_API_KEY`          | `dev-ai-key`              | Key the AI sends in `X-API-Key`                 |
| `OFFLINE_TIMEOUT`     | `120`                     | Seconds without heartbeat before OFFLINE        |
| `LOCK_TIMEOUT`        | `120`                     | Seconds without activity before a lock expires  |
| `SWEEP_INTERVAL`      | `10`                      | Seconds between timeout checks (`0` = off)      |
| `MEDIA_DIR`           | `backend/media`           | Where incident clips are stored                 |
| `TRAINING_DIR`        | `backend/training_data`   | Uploaded datasets and trained models            |
| `MAX_DATASET_MB`      | `5000`                    | Largest dataset zip / model file accepted       |
| `WORKER_TIMEOUT`      | `60`                      | Seconds before a silent training worker is offline |
| `STATIONS_FILE`       | `backend/data/stations.json` | Police, fire, hospital and tow stations      |
| `CORS_ORIGINS`        | `http://localhost:5173`   | Comma-separated frontend origins                |

## Using the API (for the frontend)

- `POST /api/auth/login` with `{role, username, password}` returns `{token, operator}`.
  Send `Authorization: Bearer <token>` on every other request.
- Call `POST /api/operators/heartbeat` every 30 s. It keeps the operator online **and**
  keeps the lock on the incident they are reviewing.
- JSON is camelCase. Errors look like `{"error": "INCIDENT_ALREADY_ASSIGNED", "message": "..."}`.
- Clips are served at the incident's `videoUrl` (e.g. `/media/INC-1001.mp4`).

Admin flow:

```text
GET  /api/operators/me                 -> currentIncidentId = incident assigned to me
GET  /api/incidents/{id}               -> canEdit=false means READ ONLY (another admin holds it)
POST /api/incidents/{id}/review        when the page opens     (ASSIGNED -> UNDER_REVIEW)
GET  /api/incidents/{id}/stations      3 nearest stations per service, nearest first
POST /api/incidents/{id}/draft         {services: [...], stations: {POLICE: "osm:n123"}}   SAVE DRAFT
POST /api/incidents/{id}/send          {services: [...], stations: {...}}                  SEND ALERT
POST /api/incidents/{id}/decline                               DECLINE
POST /api/operators/pause | resume
GET  /api/alerts, /api/statistics, /api/operators
```

Service operator flow:

```text
GET  /api/alerts                        only my service's alerts (canAccept / canUpdate flags)
POST /api/alerts/{id}/accept            first ACTIVE operator to accept takes it
POST /api/alerts/{id}/status            {status: EN_ROUTE | ON_SCENE | RESOLVED}
```

Full schemas: http://localhost:8000/docs.

## How it behaves

- **Assignment.** A new incident goes to an `ACTIVE` admin straight away; the admin becomes `BUSY`.
  With several idle admins, the one who waited longest since their last incident gets it.
  With none, it waits (`WAITING_FOR_OPERATOR`), served HIGH → MEDIUM → LOW, oldest first,
  as soon as an admin logs in, resumes or finishes an incident.
- **Locking.** Only the assigned admin can review/draft/send/decline (`409` otherwise),
  enforced in the backend with row locks (`SELECT ... FOR UPDATE SKIP LOCKED` on PostgreSQL).
- **Pause.** No new incidents; the incident in hand stays with the admin.
- **Timeouts.** A background job marks operators without heartbeat `OFFLINE`, puts their
  locked incident back in the queue and reassigns it. Logging out hands it over immediately.
- **Alerts.** Sending creates one alert per selected service. The incident becomes
  `IN_PROGRESS` when a service accepts and `RESOLVED` when every service has resolved.

Choices not spelled out in the main README:

- Drafts are stored on the incident (`selectedServices`); alerts only exist once sent,
  so alert statuses are `SENT → ACCEPTED → EN_ROUTE → ON_SCENE → RESOLVED` (no PENDING/DECLINED alerts —
  a declined incident has status `DECLINED`).
- Alerts are not pushed to a specific service operator: every operator of the service sees
  them and the first available one accepts.
- An operator's current incident is computed from the incidents/alerts tables instead of
  being stored on the operator, so the two can never disagree.
- `possibleInjuries` = a person was detected, or fire, or an overturned vehicle.
- No migrations yet: tables are created at startup, and new nullable columns are added to an
  existing database (`add_missing_columns`). Any other schema change needs Alembic.

## AI suggested response

The AI pipeline reports what it saw (vehicles, people, fire, overturned vehicle); the backend
decides which services to suggest, with a reason for each (`services/ai_service.py`). Only the
services the situation needs are suggested: Police always, Ambulance when someone may be hurt,
Pompiers only for a fire or an overturned vehicle, Dépannage when a vehicle must be removed.
A `responders` list sent by older AI versions is ignored.

## Nearest stations

For each service the AI suggests, the admin sees the station that would respond: the nearest
one, or another of the 3 nearest. The AI decides *which services*; *which station* is a distance
calculation, not AI. Each alert records the station called (`station` on alerts), which the
service operator sees.

- **Data**: `backend/data/stations.json`, about 950 stations across Ile-de-France from
  OpenStreetMap (police stations and gendarmeries, hospitals with an emergency department,
  fire stations, tow companies and impound lots). Refresh it with
  `python -m backend.import_stations`; the backend only reads the file, so it never calls an
  external service while running. The import leaves out places that don't respond to road
  accidents (investigation brigades, eye and psychiatric hospitals, airport fire crews...), and
  fills in missing towns and addresses from the national address database (IGN Geoplateforme).
- **Dépannage is sparse**: few tow companies are mapped in OpenStreetMap (about 25 in the region),
  so the nearest one can be several km away.
- **Distances** are straight lines; drive times assume roads 1.4x longer than the straight line
  at 35 km/h, an order of magnitude only (there is no routing).
- Station data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

## AI training (admin "AI Training" page)

Admins upload datasets, start training jobs, compare models and choose the **active** model,
the one the detector uses. Training runs on the GPU machine in a separate worker:

```bash
.venv\Scripts\python -m ai.trainer --backend http://localhost:8000     # add --device 0 for the first GPU
```

- **Datasets** are YOLO-format zips (a Roboflow "YOLOv8" export): `data.yaml` plus `train/` and
  `valid/` folders. The backend only reads the class names and counts the images. The worker
  extracts images and labels only, and writes its own `data.yaml`: Ultralytics executes the
  `download:` field of a dataset's yaml, so an uploaded one is never used.
- **Jobs** fine-tune one of our models or a stock YOLO11 checkpoint. The worker claims queued jobs,
  reports metrics after every epoch (shown live), and uploads `best.pt`. Cancelling stops after the
  current epoch. A job whose worker stops responding is marked failed.
- **Operator feedback**: frames of incidents an admin *declined* are added as background images
  (false alarms the model should stop raising). Optionally, *confirmed* incidents are added with
  boxes drawn by the active model.
- **Models**: the pretrained YOLO11x is registered on first start (metrics as reported by its
  author). A trained model is never activated automatically; an admin compares and decides. The
  detector (`ai.main --backend ...`) loads the active model when it starts, checking its sha256.

Worker endpoints (`/api/training/worker/...`) use the `X-API-Key` header, like the AI pipeline.
