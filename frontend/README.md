# Nexora SafeRoad — Frontend

React + TypeScript + Vite, with Leaflet/OpenStreetMap for the map and Recharts for statistics.
Implements the pages and navigation described in the main [README](../README.md).

## Run it

Start the backend first (see [backend/README.md](../backend/README.md)), then:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server forwards `/api` and `/media` to the backend at `http://localhost:8000`.
To use another address: `BACKEND_URL=http://host:port npm run dev`.

Sign in with the demo accounts, password `saferoad`: `admin1`, `admin2`, `admin3`, `police1`,
`ambulance1`, `pompiers1`, `depannage1`.

Other commands:

```bash
npm run typecheck    # strict TypeScript
npm run build        # type check + production build in dist/
```

## Structure

```text
src/
├── main.tsx              entry point
├── routes.tsx            pages per role; the admin and operator areas are guarded by role
├── pages/
│   ├── Login.tsx
│   ├── admin/            Dashboard, Incidents, IncidentDetails, Alerts, Statistics,
│   │                     Training (models, datasets, jobs) and TrainingJob (live progress)
│   └── operator/         Dashboard, Incidents, IncidentDetails, Alerts (Police, Ambulance,
│                         Pompiers and Dépannage share these; the backend filters the data)
├── components/           Layout (sidebar + header), map, video, service picker, badges...
├── services/
│   ├── api.ts            typed calls to the backend
│   ├── auth.tsx          session, heartbeat every 30 s, operator status refresh
│   └── usePolling.ts     pages refresh their data every 5 s (the backend has no push)
├── types/api.ts          the backend's JSON shapes
├── labels.ts             wording shown to operators for each status code
└── format.ts             dates, durations, locations
```

## How it behaves

- The header always shows the operator's status with **Pause / Resume**, and a banner linking
  to the incident assigned to them.
- Opening an incident assigned to you starts its review. Other admins see it **read only**.
- The admin can change the AI's suggested services before **Send alert**, **Decline** or
  **Save draft**.
- Service operators see new alerts for their service (count in the sidebar), **Accept** one,
  then move it through *en route → on scene → resolved*.
- The session is kept per browser tab. Signing in elsewhere ends it (one session per operator).
- **AI Training** (admins): upload a dataset, start a training job, follow it live, then activate
  the new model. Training needs the worker running: `python -m ai.trainer` (see backend/README.md).
