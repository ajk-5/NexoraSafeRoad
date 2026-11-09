# Nexora SafeRoad — Frontend

The operations console: React 19 + TypeScript (strict) + Vite, with Leaflet/OpenStreetMap for the
maps and Recharts for the charts. One application with an area per role — super admin, admin and
service operators — all talking to the [backend](../backend/README.md).

Back to the [main README](../README.md) · [backend](../backend/README.md) · [AI](../ai/README.md).

---

## Run it

Start the backend first, then:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server forwards `/api` and `/media` to the backend at `http://localhost:8000`.
To use another address: `BACKEND_URL=http://host:port npm run dev`.

Sign in by choosing the role in **Sign in as**, then the account (password `saferoad` for the demo
accounts): `superadmin`, `admin1`–`admin3`, `police1`, `ambulance1`, `pompiers1`, `depannage1`.

```bash
npm test             # unit and component tests (Vitest + Testing Library, jsdom)
npm run typecheck    # strict TypeScript, tests included
npm run build        # type check + production build in dist/
npm run preview      # serve the production build locally
```

## Areas and pages

| Area | Pages |
|---|---|
| **Super admin** `/superadmin` | **Overview** (platform figures and charts) · **Incidents** (all, plus the alerts sent) · read-only incident page · **History** · **Map** · **AI & Training Data** (models, datasets & training, training jobs, prediction review) · **Accounts** (create accounts, see availability) |
| **Admin** `/admin` | **Dashboard** (queue + review workspace) · **Incidents** · **Map** · **History** |
| **Service operators** `/operator` | **Dashboard** (alerts + intervention workspace) · **Incidents** · **Map** |

Each area is shown only to its role; anyone else is sent to their own home page. Addresses from
earlier versions (`/admin/incidents/:id`, `/admin/statistics`, `/admin/training`…) redirect.

## How it works for each role

**Admins** work from the **Dashboard**: the incident queue on the left (most urgent first or
newest first; All / Waiting / Mine / High; search on demand), the selected incident on the right.
The incident assigned to the admin opens by itself.

1. **Verify the clip** — watch the video next to the AI assessment, then *Confirm accident* or
   *False alarm*. Confirming is recorded by the backend and alerts nobody yet.
2. **Choose services** — the AI's suggestion is preselected with its reasons and the nearest
   station per service; change it if the clip shows otherwise. *Save review* keeps the choice.
3. **Send the alert** — a dialog names the incident, each service and station. Success is shown
   only once the backend confirms it.

Incidents held by another admin are **read only** ("Currently handled by …"); the backend enforces
the lock, the console reflects it and explains conflicts. **Pause** stops new assignments; with an
incident in hand the admin chooses to keep it or return it to the queue.

**Service operators** get the same layout: their alerts on the left (New / Mine / All), the
incident on the right with *Accept this alert*, then *We're en route → We're on scene → Mark
resolved*, the responding station on the map and the progress of the other services.

**The super admin** follows the platform without taking part in incident handling: no queue, no
Pause/Resume, no notifications. They train and activate models, review how admins judged the AI's
predictions, create accounts, and read every incident without being able to change it.

## Design system

- **Tokens** — colours, spacing (4–48 px), type, radii and shadows are CSS variables in
  `src/styles/tokens.css`. Dark mode redefines the same tokens (`<html data-theme="dark">`, chosen
  in the account menu: light, dark or system).
- **Severity** is always a word plus a 1–3 bar glyph (map markers carry H/M/L), never colour alone.
- **Actions**: primary actions are 48 px high; dangerous ones are outlined, set apart and confirmed
  in a dialog that opens on *Cancel*.
- **No UI framework**: plain CSS, an inline icon set, Inter self-hosted (`@fontsource-variable/inter`).
- **Accessibility**: semantic headings and landmarks, skip link, visible focus, labelled controls,
  native `<dialog>` modals, live regions for status and errors, reduced-motion support. Checked
  with axe (WCAG 2.2 A/AA) in light and dark themes.
- **Responsive**: full sidebar ≥ 1600 px, icon rail with short labels on laptops and tablets, a
  drawer on phones. Phones show the list first, then the incident full screen.

## Data and refresh

The backend has no push channel, so the console polls:

- One shared poll per area (`services/live.tsx`): the queue, the map, the lists and the header all
  read the same data, every 5 s.
- `services/usePolling.ts` never runs two requests at once, backs off while the server fails
  (5 → 10 → 20 → 30 s), stops while the tab is hidden and refreshes when it comes back.
- The header shows **Live**, **Data may be outdated** or **Connection lost**; pages keep showing
  the last data with a warning and a *Retry now* button.
- Every action reports success only after the backend answered; a lost connection is reported as
  "not confirmed", never as done.

## Code layout

```text
src/
├── main.tsx              entry point (theme applied before the first paint)
├── routes.tsx            areas per role, page titles, lazy-loaded heavy pages, redirects
├── paths.ts              area of each role, where an incident opens
├── domain/               pure rules, unit tested: queue order and filters, review stages,
│                         timeline, severity explanation (mirrors ai/severity.py), alert queue
├── components/
│   ├── Layout.tsx        sidebar / rail / drawer, header, current-work banner
│   ├── header/           connection status, Pause/Resume, notifications, account menu
│   ├── queue/            incident queue (admins) and alert queue (service operators)
│   ├── workspace/        incident summary, video player, AI assessment, decision panel,
│   │                     service selector, intervention panel, location, activity timeline
│   ├── maps/             Leaflet maps (one incident with stations, all incidents)
│   ├── Dialog.tsx        accessible modal on <dialog>
│   └── Badges.tsx, ui.tsx, Icon.tsx, IncidentTable.tsx, ActivateModelDialog.tsx
├── pages/
│   ├── Login.tsx, MapPage.tsx
│   ├── superadmin/       Overview, Accounts, IncidentView, Training, TrainingJob
│   ├── admin/            Dashboard, Incidents, History (Incidents and History also serve the super admin)
│   └── operator/         Dashboard, Incidents
├── services/             api (typed calls), auth (session, heartbeat), live data, polling,
│                         connection status, theme, clock
├── styles/               tokens, base, components, layout, workspace, pages
├── labels.ts             the wording shown for every backend code
├── format.ts             dates, durations, distances
└── test/                 test setup and fixtures
```
## Live alerts and settings

Signed-in pages connect to `/api/live` over WebSocket. The session token is sent in the first frame, never in the URL. The server checks for changes to the operator's visible incidents, alerts and assignment every second, using fresh database sessions so updates from other workers are observed. Changed data is then fetched through the existing authenticated API. The socket reconnects automatically; five-second polling remains a fallback while the tab is visible. Reverse proxies must forward WebSocket upgrades for `/api/live`; the Vite proxy already does this.

Open **Settings** in the sidebar to adjust alert sound, volume, repetition and appearance. Admins hear newly assigned incidents; service operators hear pending alerts for their service. The alternating six-pulse tone repeats every eight seconds by default. Opening an admin review, accepting an alert, or selecting **Silence these alerts** stops it; new alerts still sound. Preferences are stored per account in this browser.

Select **Enable alert sound** once after loading the app, or use **Test alert sound** in Settings. Browsers require user interaction before allowing audio. Keep the app open: sleeping devices, suspended tabs and muted device audio can prevent notifications. No external sound download or browser notification permission is required.
