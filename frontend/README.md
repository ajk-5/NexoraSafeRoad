# Nexora SafeRoad frontend

The operator console is a React + TypeScript application built with Vite. It uses the FastAPI backend in `../backend`; it does not include mock incident data or local action fallbacks.

## Run locally

Start the API from the repository root using the instructions in [`../backend/README.md`](../backend/README.md), then in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Seeded demo usernames and the shared demo password (`saferoad`) are listed in the backend README.

Set the backend origin in `frontend/.env.local` when it is not running at the default address:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

The value is the backend origin only (no `/api` suffix). The backend must allow the frontend origin in `CORS_ORIGINS`. Restart Vite after changing environment variables.

## Workspaces

- **Control room / Admin:** overview, incidents, incident review (save draft, send selected service alerts, decline), alert history, and backend statistics.
- **Service operators:** role-filtered dashboard, incident and alert views, accepting an available alert, and advancing an assigned intervention through `EN_ROUTE`, `ON_SCENE`, and `RESOLVED`.
- Operator availability can be paused/resumed in the header. Authenticated sessions are kept in `sessionStorage`, cleared on sign-out, and validated against `/api/operators/me` on reload. The app sends the API heartbeat every 30 seconds and refreshes the active view at the same interval.

## API and current limitations

All requests use the backend contract documented in [`../backend/README.md`](../backend/README.md). The UI displays backend errors (including lock conflicts) rather than silently treating failed operations as successful. Incident and alert visibility is provided by the backend's role-scoped routes.

The backend returns incident coordinates but does not provide map tiles, a geocoding service, or a live map endpoint. The dashboard therefore presents a location register with coordinates and links to OpenStreetMap instead of claiming to provide an embedded live map. Incident clips are played from the backend's `videoUrl`; a missing clip is shown as unavailable. The API exposes no push/SSE feed, so screens refresh periodically rather than claiming real-time push updates.

## Build

```powershell
npm run build
```
