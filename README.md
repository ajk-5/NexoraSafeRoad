# Nexora SafeRoad

> AI-assisted road accident detection and incident management platform.

Nexora SafeRoad is a SafeCity / DataCity prototype designed to detect possible road accidents from video footage, estimate their severity, and help human operators coordinate an appropriate response.

The system uses artificial intelligence to assist decision-making, but the **final decision always remains with a human operator**.

---



**Prototype / MVP**

Main workflow:

```text
Video
  ↓
AI Detection
  ↓
Incident Created
  ↓
Admin Assignment
  ↓
Human Verification
  ↓
AI Response Suggestion
  ↓
Admin Decision
  ↓
Alert Services
  ↓
Service Operator Intervention
  ↓
Resolved
```

---

## 1. Project Objectives

Nexora SafeRoad aims to:

- Detect possible road accidents automatically
- Analyze a short video sequence
- Estimate accident severity
- Detect vehicles and people involved
- Geolocate the incident
- Display incidents on an interactive map
- Provide a simple monitoring dashboard
- Suggest which services should be contacted
- Allow a human Admin Operator to confirm or modify the AI suggestion
- Send alerts to selected services
- Track intervention status
- Store incident and alert history
- Display incident statistics
- Distribute incidents between active operators
- Prevent two operators from handling the same incident at the same time
- Reassign an incident if an operator becomes unavailable

The services concerned are:

- Police
- Ambulance / SAMU
- Pompiers
- Dépannage

---

## 2. Core Principle

Nexora SafeRoad is an **AI-assisted system**, not an autonomous emergency dispatch system.

```text
AI Detects
    ↓
AI Analyses
    ↓
AI Recommends
    ↓
Human Reviews
    ↓
Human Decides
```

The AI can recommend actions, but it does not directly contact real emergency services in the MVP.

The human operator can:

- Accept the AI recommendation
- Remove one or more suggested services
- Add another service
- Select all services
- Send the alert
- Decline the alert

---

## 3. User Roles

The system has two main user groups.

```text
Nexora SafeRoad
│
├── Admin Operator
│
└── Service Operator
    ├── Police Operator
    ├── Ambulance Operator
    ├── Pompiers Operator
    └── Dépannage Operator
```

### Admin Operator

The Admin Operator:

- Reviews newly detected incidents
- Watches the short incident video
- Checks the AI analysis
- Confirms or modifies the suggested services
- Sends or declines alerts
- Monitors incidents
- Views alerts
- Views statistics
- Tracks service operator progress

### Service Operator

Police, Ambulance, Pompiers and Dépannage use the same operator interface.

The connected user's role determines which alerts and incidents are visible.

Example:

```text
Police Operator
→ Police incidents and alerts only

Ambulance Operator
→ Ambulance incidents and alerts only

Pompiers Operator
→ Pompiers incidents and alerts only

Dépannage Operator
→ Dépannage incidents and alerts only
```

---

## 4. UI / UX Principles

The interface must be simple enough for an operator to understand the situation and take action quickly.

Main principles:

- Few pages
- Few buttons
- Clear labels
- Same navigation on every page
- Important information visible first
- One main action per screen
- Short incident video
- Simple map
- Clear severity level
- Operator status always visible
- No unnecessary technical AI information

The operator should see information such as:

```text
Incident detected
Severity: HIGH
Location: A7 - KM 32.4
Vehicles: 3
Possible injuries: Yes
```

The operator should not need to see:

```text
Bounding box coordinates
Tensor output
Model inference internals
Database IDs
Raw AI model logs
```

---

## 5. Admin Navigation

The Admin sidebar is identical on every Admin page.

```text
Dashboard
Incidents
Alerts
Statistics
```

The same sidebar must remain visible throughout the Admin interface.

---

## 6. Service Operator Navigation

The Service Operator sidebar is identical on every operator page.

```text
Dashboard
Incidents
Alerts
```

The same interface is used for:

- Police
- Ambulance
- Pompiers
- Dépannage

Only the data changes depending on the connected role.

---

## 7. Login

The login screen should remain simple.

The user selects a role from a dropdown:

```text
Sign in as:

Admin
Police
Ambulance
Pompiers
Dépannage
```

Login fields:

```text
Username
Password
```

The system then loads the correct interface based on the selected role.

---

## 8. Admin Dashboard

The Admin Dashboard provides a quick overview of the system.

```text
┌────────────────────────────────────────────┐
│ Dashboard                                  │
├────────────────────────────────────────────┤
│                                            │
│             Live Incident Map              │
│                                            │
├──────────────────────┬─────────────────────┤
│ Recent Alerts        │ Statistics          │
│                      │                     │
└──────────────────────┴─────────────────────┘
```

The dashboard can display:

- Active incidents
- Incident locations
- Severity levels
- Recent alerts
- Incident statistics
- Operator availability

---

## 9. Admin Incidents Page

The Admin `Incidents` page contains incidents detected by the system.

Example:

```text
INC-1001

Location:
A7 - KM 32.4

Severity:
HIGH

Status:
PENDING_VALIDATION

Assigned:
Admin Operator 03
```

Possible columns:

```text
ID
Preview
Date / Time
Location
Severity
Status
Assigned Operator
```

Selecting an incident opens the incident detail page.

---

## 10. Admin Incident Detail Page

The incident page is the main decision screen for an Admin Operator.

```text
┌───────────────────────┬───────────────────────┐
│                       │                       │
│    Incident Video     │    Incident Details   │
│                       │                       │
├───────────────────────┴───────────────────────┤
│                                               │
│              AI Analysis Summary              │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│             AI Suggested Response             │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│      SEND ALERT     DECLINE     SAVE DRAFT    │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 11. Incident Video

When an accident is detected, the system stores a short video sequence.

For the MVP:

```text
10-second incident clip
```

Example:

```text
Camera C12

▶ 00:00 ───────────── 00:10
```

The Admin Operator uses this video to verify whether the AI detection is correct.

---

## 12. Incident Information

Only useful information is shown.

Example:

```text
Incident:
INC-1001

Location:
A7 - KM 32.4

Time:
10:24

Severity:
HIGH

Vehicles:
3

Possible injuries:
YES

Road impact:
2 lanes blocked

AI confidence:
87%
```

---

## 13. AI Suggested Response

After analysis, the AI proposes which services may be required.

Example:

```text
AI Suggested Response

☑ Police
☑ Ambulance
☑ Pompiers
☐ Dépannage
```

The system may explain each recommendation.

```text
Police
Reason: Traffic management

Ambulance
Reason: Possible injuries

Pompiers
Reason: Vehicle extraction

Dépannage
Reason: Vehicle removal
```

---

## 14. Human Validation

The Admin Operator always keeps control.

Example AI recommendation:

```text
☑ Police
☑ Ambulance
☑ Pompiers
☐ Dépannage
```

The Admin Operator can modify it to:

```text
☑ Police
☑ Ambulance
☐ Pompiers
☑ Dépannage
```

The Admin can therefore:

- Add a service
- Remove a service
- Select multiple services
- Select all services
- Send the alert
- Decline the alert

---

## 15. Admin Actions

Three main actions are available on an incident.

### Send Alert

```text
SEND ALERT
```

Sends the alert to all selected services.

### Decline

```text
DECLINE
```

Rejects the alert.

This can be used when the AI generated a false positive or when no intervention is required.

### Save Draft

```text
SAVE DRAFT
```

Keeps the decision for later review.

---

## 16. Admin Alerts Page

The Admin Alerts page stores alert history.

Example:

```text
INC-1001

Services:
Police
Ambulance

Status:
SENT

Severity:
HIGH

Time:
10:24
```

Possible alert statuses:

```text
PENDING
SENT
DECLINED
```

---

## 17. Admin Statistics Page

The Statistics page should remain simple.

It can display:

- Total incidents
- Incidents per day
- Incidents by severity
- Incidents by area
- Average response time
- Alerts by service
- Resolved incidents

Example:

```text
Incidents

40 |
30 |        █
20 |    █   █       █
10 | █  █   █   █   █
   +--------------------
     Mon Tue Wed Thu Fri
```

---

## 18. Service Operator Dashboard

The Service Operator Dashboard shows only information relevant to that service.

```text
┌───────────────────────────────────────────┐
│ Dashboard                                 │
├───────────────────────────────────────────┤
│                                           │
│               Incident Map                │
│                                           │
├─────────────────────┬─────────────────────┤
│ Assigned Incidents  │ Recent Alerts       │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

A Police Operator should only see Police incidents.

An Ambulance Operator should only see Ambulance incidents.

The same rule applies to Pompiers and Dépannage.

---

## 19. Service Operator Incident Page

The Operator Incident page contains:

- Short video
- Incident details
- Location
- Severity
- Description
- Current status

Example:

```text
INC-1001

Location:
A7 - Paris

Severity:
HIGH

Vehicles:
3

Status:
ASSIGNED
```

---

## 20. Service Operator Intervention Status

The operator can update the intervention status.

```text
ASSIGNED
    ↓
ACCEPTED
    ↓
EN_ROUTE
    ↓
ON_SCENE
    ↓
RESOLVED
```

The Admin Operator can follow these updates.

---

## 21. Service Operator Alerts Page

The Alerts page contains the alert history for the connected service.

Example:

```text
INC-1001

Multiple vehicles involved

Severity:
HIGH

Status:
NEW

Received:
2 min ago
```

---

## 22. Operator Availability

Each Admin or Service Operator has a status.

```text
ACTIVE
BUSY
PAUSED
OFFLINE
```

### ACTIVE

The operator is connected and available.

A new incident can be assigned.

### BUSY

The operator is currently handling an incident.

For the MVP, one operator handles one active incident at a time.

### PAUSED

The operator is connected but temporarily unavailable.

Possible reasons:

- Break
- Lunch
- Meeting
- Temporary absence

No new incident is assigned while the operator is paused.

### OFFLINE

The operator is disconnected or no longer responding.

---

## 23. Pause / Resume

The operator status is always visible in the header.

Example:

```text
Admin Operator 03

● ACTIVE

[ PAUSE ]
```

When the operator clicks `PAUSE`:

```text
Admin Operator 03

⏸ PAUSED

[ RESUME ]
```

When the operator returns, clicking `RESUME` changes the status back to:

```text
ACTIVE
```

### Important Pause Rule

Pause means:

> Do not assign me new incidents.

Pause must not automatically remove an incident that the operator is already processing.

Example:

```text
Admin handles INC-1001
        ↓
Admin clicks PAUSE
        ↓
INC-1001 remains assigned
        ↓
No new incident is assigned
```

---

## 24. Automatic Admin Assignment

When an incident is created, the backend searches for an available Admin Operator.

Only operators with:

```text
status = ACTIVE
```

can receive new incidents.

Example:

```text
Admin A → BUSY
Admin B → PAUSED
Admin C → ACTIVE
Admin D → OFFLINE
```

The incident is assigned to:

```text
Admin C
```

---

## 25. Incident Distribution

For the MVP, the backend can assign an incident to the active operator with the smallest current workload.

Example:

```text
Admin A → 2 incidents
Admin B → 0 incidents
Admin C → 1 incident
```

The next incident is assigned to:

```text
Admin B
```

This keeps distribution simple and fair.

---

## 26. Waiting Queue

If no Admin Operator is currently available:

```text
Admin A → BUSY
Admin B → PAUSED
Admin C → OFFLINE
```

the incident enters:

```text
WAITING_FOR_OPERATOR
```

Example queue:

```text
1. INC-1012    HIGH
2. INC-1013    MEDIUM
3. INC-1014    LOW
```

As soon as an Admin Operator becomes `ACTIVE`, the system assigns the next incident.

---

## 27. Incident Priority

Waiting incidents are ordered by severity.

```text
HIGH
 ↓
MEDIUM
 ↓
LOW
```

If two incidents have the same severity, the oldest incident is processed first.

---

## 28. Incident Locking

An incident can only be actively handled by **one Admin Operator at a time**.

When an Admin receives an incident:

```text
INC-1001

Assigned to:
Admin Operator 03

Status:
UNDER_REVIEW
```

the incident becomes locked.

Other Admin Operators may still see it, but they cannot modify it.

Example:

```text
INC-1001

Currently handled by:
Admin Operator 03

READ ONLY
```

The following actions are disabled for other operators:

```text
Send Alert
Decline
Modify Services
Save Decision
```

---

## 29. Backend Lock Data

The backend can store:

```text
assigned_operator_id
locked_at
last_activity_at
```

Example:

```json
{
  "incidentId": "INC-1001",
  "assignedOperatorId": 3,
  "status": "UNDER_REVIEW",
  "lockedAt": "2026-10-06T14:20:00",
  "lastActivityAt": "2026-10-06T14:21:30"
}
```

---

## 30. Heartbeat

The frontend periodically tells the backend that the operator is still active.

Example:

```text
Frontend
    ↓
Every 30 seconds
    ↓
POST /operators/heartbeat
```

The backend updates:

```text
last_seen_at
```

Example:

```json
{
  "operatorId": 3,
  "status": "ACTIVE",
  "lastSeenAt": "2026-10-06T14:22:00"
}
```

---

## 31. Detecting Operator Absence

If the backend does not receive a heartbeat for a defined period:

```text
No heartbeat
      ↓
120 seconds
      ↓
Operator = OFFLINE
```

The operator is no longer considered available.

For the MVP:

```text
OFFLINE_TIMEOUT = 120 seconds
```

---

## 32. Incident Lock Timeout

An incident lock must not remain permanent if an operator disappears.

For the MVP:

```text
LOCK_TIMEOUT = 120 seconds
```

Workflow:

```text
Incident locked
      ↓
No operator activity
      ↓
Timeout
      ↓
Release lock
      ↓
Find another ACTIVE Admin
      ↓
Reassign incident
```

---

## 33. Automatic Reassignment

If an Admin becomes unavailable before completing the review:

```text
Admin A
   ↓
INC-1001 assigned
   ↓
Admin A becomes OFFLINE
   ↓
Lock expires
   ↓
Search another ACTIVE Admin
   ↓
INC-1001 → Admin B
```

This prevents incidents from remaining blocked.

---

## 34. Concurrency Rule

The backend must always verify that the current operator owns the incident before accepting a modification.

Conceptually:

```text
Is this incident assigned to this operator?
```

If yes:

```text
Request accepted
```

If no:

```text
409 Conflict
```

Example response:

```json
{
  "error": "INCIDENT_ALREADY_ASSIGNED",
  "message": "This incident is currently handled by another operator."
}
```

This validation must happen in the backend.

The frontend alone is not sufficient for security or concurrency control.

---

## 35. Incident Lifecycle

An incident can use the following statuses:

```text
DETECTED
WAITING_FOR_OPERATOR
ASSIGNED
UNDER_REVIEW
ALERT_SENT
DECLINED
IN_PROGRESS
RESOLVED
```

Main lifecycle:

```text
DETECTED
    ↓
WAITING_FOR_OPERATOR
    ↓
ASSIGNED
    ↓
UNDER_REVIEW
    ↓
 ┌───────────────┐
 ↓               ↓
ALERT_SENT     DECLINED
 ↓
IN_PROGRESS
 ↓
RESOLVED
```

---

## 36. Admin Operator Lifecycle

```text
OFFLINE
   ↓
Login
   ↓
ACTIVE
   ↓
Incident assigned
   ↓
BUSY
   ↓
Incident completed
   ↓
ACTIVE
```

Pause flow:

```text
ACTIVE
   ↓
PAUSE
   ↓
PAUSED
   ↓
RESUME
   ↓
ACTIVE
```

---

## 37. Service Operator Lifecycle

```text
OFFLINE
   ↓
Login
   ↓
ACTIVE
   ↓
Alert assigned
   ↓
BUSY
   ↓
Intervention completed
   ↓
ACTIVE
```

Pause works in the same way:

```text
ACTIVE ↔ PAUSED
```

---

## 38. System Architecture

```text
                    Camera / Video
                           │
                           ▼
                    Python + OpenCV
                           │
                           ▼
                      YOLO Model
                           │
                           ▼
                  Accident Detection
                           │
                           ▼
                   Severity Analysis
                           │
                           ▼
                       FastAPI
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
         PostgreSQL                 React + TS
              │                         │
              │              ┌──────────┼──────────┐
              │              ▼          ▼          ▼
              │             Map       Alerts    Statistics
              │
              ▼
       Operator Management
              │
              ▼
      Incident Assignment
```

---

## 39. Technology Stack

### Artificial Intelligence

- Python
- YOLO
- PyTorch
- OpenCV

The AI analyzes video frames and detects possible road accidents.

### Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL

The backend handles:

- Users
- Roles
- Operators
- Incidents
- Assignments
- Incident locks
- Alerts
- Statistics
- AI suggestions
- Operator availability
- Reassignment

### Frontend

- React
- TypeScript
- CSS
- Leaflet
- OpenStreetMap
- Recharts

### Development Tools

- Git
- GitHub
- Docker
- Docker Compose
- Roboflow

---

## 40. Project Structure

```text
NexoraSafeRoad/
│
├── ai/
│   ├── models/
│   │   └── accident_model.pt
│   ├── detector.py
│   ├── video_processor.py
│   ├── severity.py
│   └── requirements.txt
│
├── backend/
│   ├── main.py
│   ├── database.py
│   │
│   ├── models/
│   ├── schemas/
│   ├── routes/
│   │   ├── auth.py
│   │   ├── incidents.py
│   │   ├── alerts.py
│   │   ├── operators.py
│   │   └── statistics.py
│   │
│   └── services/
│       ├── incident_service.py
│       ├── assignment_service.py
│       ├── operator_service.py
│       ├── alert_service.py
│       └── ai_service.py
│
├── frontend/
│   ├── src/
│   │
│   ├── components/
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Incidents.tsx
│   │   │   ├── IncidentDetails.tsx
│   │   │   ├── Alerts.tsx
│   │   │   └── Statistics.tsx
│   │   │
│   │   └── operator/
│   │       ├── Dashboard.tsx
│   │       ├── Incidents.tsx
│   │       ├── IncidentDetails.tsx
│   │       └── Alerts.tsx
│   │
│   ├── services/
│   └── types/
│
├── dataset/
│
├── docs/
│   ├── architecture.md
│   └── wireframes/
│
├── docker-compose.yml
│
└── README.md
```

---

## 41. Operator Model

Example:

```text
Operator
----------------------------

id
username
password_hash
role
status
last_seen_at
current_incident_id
created_at
updated_at
```

Possible roles:

```text
ADMIN
POLICE
AMBULANCE
POMPIERS
DEPANNAGE
```

Possible statuses:

```text
ACTIVE
BUSY
PAUSED
OFFLINE
```

---

## 42. Incident Model

Example:

```text
Incident
----------------------------

id
latitude
longitude
severity
confidence
vehicles
possible_injuries
video_url
status
assigned_admin_id
locked_at
last_activity_at
created_at
updated_at
```

---

## 43. Alert Model

Example:

```text
Alert
----------------------------

id
incident_id
service_type
status
assigned_operator_id
sent_at
accepted_at
resolved_at
created_at
updated_at
```

Possible service types:

```text
POLICE
AMBULANCE
POMPIERS
DEPANNAGE
```

Possible alert statuses:

```text
PENDING
SENT
ACCEPTED
EN_ROUTE
ON_SCENE
RESOLVED
DECLINED
```

---

## 44. Example Incident JSON

```json
{
  "id": "INC-1001",
  "location": {
    "latitude": 48.8566,
    "longitude": 2.3522
  },
  "severity": "HIGH",
  "confidence": 0.87,
  "vehicles": 3,
  "possibleInjuries": true,
  "status": "WAITING_FOR_OPERATOR"
}
```

---

## 45. Example AI Suggestion

```json
{
  "incidentId": "INC-1001",
  "recommendedServices": [
    "POLICE",
    "AMBULANCE",
    "POMPIERS"
  ]
}
```

The Admin Operator can modify this selection before sending the alert.

---

## 46. Suggested API Endpoints

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
```

### Operators

```text
GET  /api/operators/me
POST /api/operators/pause
POST /api/operators/resume
POST /api/operators/heartbeat
```

### Incidents

```text
GET  /api/incidents
GET  /api/incidents/{id}
POST /api/incidents
POST /api/incidents/{id}/assign
POST /api/incidents/{id}/send
POST /api/incidents/{id}/decline
POST /api/incidents/{id}/status
```

### Alerts

```text
GET  /api/alerts
GET  /api/alerts/{id}
POST /api/alerts/{id}/accept
POST /api/alerts/{id}/status
```

### Statistics

```text
GET /api/statistics
```

---

## 47. Database / Concurrency Recommendation

Incident assignment must be atomic.

Two Admin Operators must never acquire the same incident.

The backend should:

1. Start a database transaction
2. Select an available incident
3. Lock the database row
4. Verify that it is still unassigned
5. Assign it to exactly one operator
6. Commit the transaction

PostgreSQL should be the source of truth.

React only displays the state received from the backend.

---

## 48. Accident Detection

The system analyzes video using OpenCV and YOLO.

Possible detected elements:

```text
car
truck
motorcycle
person
accident
```

For the MVP, the accident model should focus on reliable incident detection rather than many classes.

---

## 49. Detection Confirmation

A single frame should not automatically trigger an incident.

### Authentication

```text
Frame 1 → Accident 88%
Frame 2 → Accident 91%
Frame 3 → Accident 90%
Frame 4 → Accident 86%
Frame 5 → Accident 93%
```

Possible MVP rule:

```text
At least 3 positive detections
with confidence >= 80%
within the last 5 analyzed frames
```

This helps reduce false positives.

---

## 50. Severity Analysis

The MVP can initially use simple rules rather than a separate AI severity model.

### Alerts

```python
def calculate_severity(
    people_involved: int,
    vehicles_involved: int,
    fire_detected: bool,
    overturned_vehicle: bool
) -> str:

    if fire_detected or overturned_vehicle or people_involved >= 3:
        return "HIGH"

    if vehicles_involved >= 2 or people_involved > 0:
        return "MEDIUM"

    return "LOW"
```

A dedicated AI severity model can be added later.

---

## 51. Map

Leaflet and OpenStreetMap are used for incident visualization.

The map can show:

- Incident location
- Severity
- Incident status
- Selected incident
- Assigned service

For the MVP, GPS coordinates may be simulated.

---

## 52. MVP Scope

The MVP focuses on this workflow:

```text
Video
   ↓
AI Detection
   ↓
Incident Created
   ↓
Find Available Admin
   ↓
Assign + Lock
   ↓
Admin Reviews Video
   ↓
AI Suggests Services
   ↓
Admin Confirms / Modifies
   ↓
Send or Decline
   ↓
Selected Service Operators Receive Alert
   ↓
Operator Updates Status
   ↓
Incident Resolved
```

For the MVP, the accident model should focus on reliable incident detection rather than many classes.

---

## 53. Features Not Included in the MVP

The prototype does not include real connections to:

- Police systems
- SAMU systems
- Pompiers systems
- Municipal emergency systems
- Real city CCTV infrastructure
- Automatic emergency calls
- Automatic dispatch systems

These behaviors are simulated.

---

## 54. Recommended Development Order

To keep development fast and manageable:

```text
1. Frontend skeleton
        ↓
2. Login + roles
        ↓
3. FastAPI backend
        ↓
4. PostgreSQL database
        ↓
5. Incident CRUD
        ↓
6. Operator ACTIVE / PAUSED / BUSY / OFFLINE
        ↓
7. Incident assignment + locking
        ↓
8. Map
        ↓
9. Video display
        ↓
10. AI detection
        ↓
11. AI service suggestion
        ↓
12. Human validation
        ↓
13. Alerts
        ↓
14. Service operator workflow
        ↓
15. Statistics
```

The complete workflow should work before adding more advanced AI features.

---

## 55. Final System Workflow

```text
                    CAMERA / VIDEO
                           ↓
                      AI DETECTION
                           ↓
                    INCIDENT CREATED
                           ↓
                 AVAILABLE ADMIN?
                   /            \
                 YES             NO
                  ↓               ↓
            ASSIGN + LOCK      WAITING QUEUE
                  ↓
             ADMIN REVIEW
                  ↓
             WATCH VIDEO
                  ↓
             AI SUGGESTION
                  ↓
            HUMAN VALIDATION
                  ↓
      ┌───────────┴───────────┐
      ↓                       ↓
 SEND ALERT                DECLINE
      ↓
Selected Services
      ↓
Police / Ambulance /
Pompiers / Dépannage
      ↓
Available Service Operator
      ↓
Accept Intervention
      ↓
EN_ROUTE
      ↓
ON_SCENE
      ↓
RESOLVED
```

A dedicated AI severity model can be added later.

---

## 56. Key Design Rule

The most important design rule is:

```text
AI detects
    ↓
AI recommends
    ↓
Human validates
    ↓
System sends
```

Nexora SafeRoad is designed as a **decision-support platform**.

It does not replace emergency operators.

It helps them react faster while keeping a human in control.


---

## Project

**Nexora SafeRoad**

SafeCity / DataCity Project

**EFREI — 2026**

---

## Frontend

The role-based React + TypeScript operator console lives in [`frontend/`](frontend/README.md). Start the FastAPI backend as described in [`backend/README.md`](backend/README.md), then run `npm install` and `npm run dev` from `frontend/`.
