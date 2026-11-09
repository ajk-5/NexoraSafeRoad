# Nexora SafeRoad — Backend

FastAPI + SQLAlchemy + PostgreSQL (SQLite for development). The backend owns every rule of the
platform: who may do what, which admin gets which incident, the lock on an incident under review,
the alerts and their progress, the statistics, and the orchestration of AI training. The console
and the AI pipeline only call it.

Back to the [main README](../README.md) · [frontend](../frontend/README.md) · [AI](../ai/README.md).

---

## Run it

With Docker (PostgreSQL included), from the repository root:

```bash
docker compose up --build        # API on http://localhost:8000, interactive docs on /docs
```

Without Docker (SQLite file `backend/saferoad.db`), from the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate           # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Tables are created on start-up; new nullable columns are added to an existing database
automatically (`add_missing_columns`). Any other schema change needs a migration tool (not set up).

Tests (82, in-memory SQLite, no server needed):

```bash
python -m unittest discover -s backend/tests -t .
```

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/saferoad.db` | e.g. `postgresql+psycopg://user:pw@host/db` |
| `AI_API_KEY` | `dev-ai-key` | Key the AI pipeline and the training worker send in `X-API-Key` |
| `OFFLINE_TIMEOUT` | `120` | Seconds without a heartbeat before an operator is `OFFLINE` |
| `LOCK_TIMEOUT` | `120` | Seconds without activity before an incident's lock expires |
| `SWEEP_INTERVAL` | `10` | Seconds between timeout checks (`0` = off) |
| `MEDIA_DIR` | `backend/media` | Where incident clips are stored (served under `/media`) |
| `TRAINING_DIR` | `backend/training_data` | Uploaded datasets and trained models |
| `MAX_DATASET_MB` | `5000` | Largest dataset zip or model file accepted |
| `WORKER_TIMEOUT` | `60` | Seconds before a silent training worker is considered offline |
| `STATIONS_FILE` | `backend/data/stations.json` | Police, fire, hospital and tow stations |
| `SEED_DEMO_OPERATORS` | `1` | Create the demo accounts on first start (`0` to disable) |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins of the console |

Change `AI_API_KEY` and the demo passwords anywhere other than a development machine.

## Accounts and roles

| Role | Can | Cannot |
|---|---|---|
| `SUPERADMIN` | Read every incident and alert; statistics; AI training (datasets, jobs, models); list and create accounts | Review, confirm, send or decline incidents; accept alerts; be assigned an incident |
| `ADMIN` | Review the incident assigned to it: confirm, choose services and stations, send, decline, release; pause/resume | Statistics, training, accounts |
| `POLICE`, `AMBULANCE`, `POMPIERS`, `DEPANNAGE` | See alerts and incidents of their own service; accept an alert and report progress | Anything outside their service |

Demo accounts (password `saferoad`): `superadmin`, `admin1`–`admin3`, `police1`, `ambulance1`,
`pompiers1`, `depannage1`. A database created before the super admin role existed gets the
`superadmin` account on the next start (unless `SEED_DEMO_OPERATORS=0`).

Sign-in returns a token: send `Authorization: Bearer <token>` on every other call. One session per
account — signing in again ends the previous one. The console calls `POST /api/operators/heartbeat`
every 30 s, which keeps the operator online **and** keeps the lock on the incident they review.

## API

JSON is camelCase. Errors look like `{"error": "INCIDENT_ALREADY_ASSIGNED", "message": "..."}`.
Full schemas: http://localhost:8000/docs.

**Sign-in and operators**

```text
POST /api/auth/login                    {role, username, password} -> {token, operator}
POST /api/auth/logout                   ends the session (an admin's incident goes back to the queue)
GET  /api/operators/me                  me, with currentIncidentId
POST /api/operators/heartbeat           every 30 s
POST /api/operators/pause | resume      availability
GET  /api/operators                     SUPERADMIN: every account and its availability
POST /api/operators                     SUPERADMIN: {username, displayName, role, password}
```

New accounts: username 3–64 characters (letters, digits, `.`, `_`, `-`), unique whatever the case
(`409 USERNAME_TAKEN`); password at least 8 characters. They start `OFFLINE` until they sign in.

**Incidents (admin review)**

```text
GET  /api/incidents                     admins and super admin: all; services: those they were alerted to
GET  /api/incidents/{id}                canEdit=false means read only for this viewer
GET  /api/incidents/{id}/stations       ADMIN: the 3 nearest stations per service, nearest first
POST /api/incidents/{id}/review         ADMIN, when the incident opens       (ASSIGNED -> UNDER_REVIEW)
POST /api/incidents/{id}/confirm        ADMIN: a real accident; sets confirmedAt, alerts nobody yet
POST /api/incidents/{id}/draft          ADMIN: {services: [...], stations: {POLICE: "osm:n123"}}
POST /api/incidents/{id}/send           ADMIN: {services, stations} -> one alert per service
POST /api/incidents/{id}/decline        ADMIN: false alarm, nobody is alerted
POST /api/incidents/{id}/release        ADMIN: back to the waiting queue (pause first)
```

**Alerts (service operators)**

```text
GET  /api/alerts                        services: their own (canAccept / canUpdate); others: all
GET  /api/alerts/{id}
POST /api/alerts/{id}/accept            the first available operator of the service takes it
POST /api/alerts/{id}/status            {status: EN_ROUTE | ON_SCENE | RESOLVED}
```

**Statistics and training (super admin)**

```text
GET  /api/statistics                    counts per status, severity, camera, day, service; response time
GET  /api/training/overview             worker, active model, queued/running jobs, feedback counts
GET  /api/training/models               POST /api/training/models/{id}/activate
GET  /api/training/datasets             POST /api/training/datasets?name=...   (raw zip body)
GET  /api/training/jobs                 POST /api/training/jobs     GET /api/training/jobs/{id}
POST /api/training/jobs/{id}/cancel
```

**AI pipeline and training worker (`X-API-Key` header)**

```text
POST /api/incidents                     report a detected accident
PUT  /api/incidents/{id}/video          the clip (raw MP4 body), then served at videoUrl
POST /api/training/worker/heartbeat     POST /api/training/worker/claim
GET  /api/training/worker/datasets/{id}/file
GET  /api/training/worker/models/active GET /api/training/worker/models/{id}/file
GET  /api/training/worker/feedback      reviewed incidents with a clip (false alarms, confirmed)
POST /api/training/worker/jobs/{id}/progress | end    PUT /api/training/worker/jobs/{id}/model
```

## How it behaves

- **Assignment.** A new incident goes to an `ACTIVE` admin straight away; the admin becomes `BUSY`.
  With several idle admins, the one who waited longest since their last incident gets it. With
  none, it waits (`WAITING_FOR_OPERATOR`) and is served High → Medium → Low, oldest first, as soon
  as an admin signs in, resumes or finishes an incident. Super admins are never in the pool.
- **Locking.** Only the assigned admin can review, confirm, draft, send, decline or release
  (`409 INCIDENT_ALREADY_ASSIGNED` otherwise), enforced with row locks (`SELECT ... FOR UPDATE SKIP
  LOCKED` on PostgreSQL), so two admins can never hold the same incident.
- **Confirm, then alert.** The console asks for `/confirm` before it shows the services. `/send`
  also sets `confirmedAt` when it is missing. A confirmation belongs to the admin who made it: it is
  cleared whenever the incident goes back to the queue (release, lock timeout, sign-out).
- **Pause.** No new incidents; the one in hand stays with the admin. `/release` hands it back to the
  queue and the next available admin gets it at once — pause first, or it can come straight back.
- **Timeouts.** A background job marks operators without a heartbeat `OFFLINE`, puts their locked
  incident back in the queue and reassigns it. Signing out hands it over immediately.
- **Alerts.** Sending creates one alert per selected service. Every operator of that service sees
  it; the first `ACTIVE` one to accept takes it and becomes `BUSY`. The incident becomes
  `IN_PROGRESS` when a service accepts and `RESOLVED` when every service has resolved.
- **Current work** is computed from the incidents and alerts tables, never stored on the operator,
  so the two cannot disagree.
- `possibleInjuries` is true when a person is visible, a vehicle is on fire or overturned.

## Suggested response

The AI reports what it saw (vehicles, people, fire, overturned vehicle); the backend decides which
services to suggest, each with a reason (`services/ai_service.py`):

| Service | Suggested when |
|---|---|
| Police | Always: secure the scene and manage traffic |
| Ambulance (SAMU) | A person visible, an overturned or burning vehicle, or 3+ vehicles |
| Firefighters (Pompiers) | A vehicle on fire or overturned |
| Road assistance (Dépannage) | 2+ vehicles, or a vehicle overturned or burnt |

The admin can add or remove services before sending.

## Nearest stations

For each service the admin sees the station that would respond — the nearest one, or another of
the three nearest. Which services is the AI's suggestion; which station is a distance calculation.
Each alert records the station called, which the service operator sees.

- **Data**: `backend/data/stations.json`, about 950 stations across Île-de-France from
  OpenStreetMap (police stations and gendarmeries, hospitals with an emergency department, fire
  stations, tow companies and impound lots). Refresh it with `python -m backend.import_stations`;
  at run time the backend only reads the file. The import leaves out places that do not respond to
  road accidents and fills in missing addresses from the national address database (IGN).
- **Road assistance is sparse**: about 25 tow companies are mapped in the region, so the nearest
  one can be several kilometres away.
- **Distances** are straight lines; drive times assume roads 1.4× longer at 35 km/h — an order of
  magnitude, not routing.

## AI training

The super admin uploads datasets, starts training jobs, compares models and chooses the
**active** model — the one the detector loads. Training runs on the GPU machine in a separate
worker (`python -m ai.trainer`, see the [AI README](../ai/README.md)).

- **Datasets** are YOLO-format zips (e.g. a Roboflow "YOLOv8" export): `data.yaml` plus `train/` and
  `valid/`. The backend reads the class names and counts the images. The worker extracts images and
  labels only and writes its own `data.yaml`, because Ultralytics executes a yaml's `download:`
  field.
- **Jobs** fine-tune one of the registered models or a stock YOLO11 checkpoint. The worker claims
  queued jobs, reports metrics after each epoch and uploads `best.pt`. Cancelling stops after the
  current epoch. A job whose worker stops responding fails.
- **Operator feedback**: frames of incidents an admin rejected are added as background images (false
  alarms to stop raising); optionally, confirmed incidents are added with boxes drawn by the active
  model.
- **Models**: the pretrained YOLO11x is registered on first start, with the metrics its author
  reports. A trained model is never activated automatically. The detector checks the sha256 of the
  file it downloads.

## Code layout

```text
backend/
├── main.py              app, routers, /media, start-up (tables, seed, background sweeper)
├── config.py            settings above
├── database.py          engine, session, UTC datetimes, add_missing_columns
├── deps.py              current operator and role guards (admin, super admin, service operator, AI key)
├── security.py          password hashing (scrypt) and session tokens
├── errors.py            error responses {error, message}
├── seed.py              demo accounts and the pretrained model
├── import_stations.py   rebuilds data/stations.json from OpenStreetMap
├── models/              operators, incidents, alerts, training (SQLAlchemy)
├── schemas/             request and response shapes (Pydantic, camelCase)
├── routes/              auth, operators, incidents, alerts, statistics, training
├── services/            assignment, incident, alert, operator, station, statistics, training rules
└── tests/               82 API tests (unittest + FastAPI TestClient)
```
