# Nexora SafeRoad

Nexora SafeRoad is an AI-based road accident detection system developed as part of our SafeCity project.

The objective is to detect road accidents from video footage, estimate their severity, geolocate the incident, and display the information on a monitoring dashboard.

For the MVP, alerts to emergency services are simulated and the system does not connect directly to real municipal infrastructure.

---

## Project Objectives

The project aims to:

- Detect road accidents automatically
- Analyze the level of severity
- Identify vehicles and people involved
- Geolocate the detected incident
- Display incidents on an interactive map

- Provide a monitoring dashboard for manual verification
- Store accident history
- Display statistics about detected incidents
- Simulate alerts the authorities responsible(police , pompiers, ambulance, depannage)based on severity of the incident with 10 sec clips

---

## MVP

The MVP focuses on the essential workflow:

```text
Video
   ↓
Accident Detection
   ↓
Severity Analysis
   ↓
Geolocation
   ↓
Backend API
   ↓
Dashboard
   ↓
Map + Statistics + Alerts
```

The MVP will not include:

- Real connection to police systems
- Real connection to emergency services
- Real city CCTV infrastructure
- Automatic emergency calls
- Direct integration with municipal systems

These actions will be simulated.

---

## Technologies

### Artificial Intelligence

- Python
- YOLO
- PyTorch
- OpenCV

The AI analyzes video frames and detects possible road accidents.

---

### Backend

- Python
- FastAPI
- PostgreSQL

The backend receives detected incidents, stores them and provides data to the frontend.

---

### Frontend

- React
- TypeScript
- Leaflet
- OpenStreetMap
- Recharts

The frontend provides the monitoring dashboard.

---

### Development Tools

- Git
- GitHub
- Docker
- Docker Compose
- Roboflow

---

## System Architecture

```text
               Camera / Video
                      |
                      v
                   OpenCV
                      |
                      v
                  YOLO AI
                      |
                      v
             Accident Detection
                      |
                      v
              Severity Analysis
                      |
                      v
                  FastAPI
                      |
             +--------+--------+
             |                 |
             v                 v
        PostgreSQL        Real-time data
             |                 |
             +--------+--------+
                      |
                      v
              React Dashboard
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
         Map       Statistics    Alerts
       Leaflet      Recharts
```

---

## Accident Severity

The system classifies detected accidents into three levels:

### LOW

Minor incident with limited impact.

Examples:

- Small collision
- One vehicle involved
- No person detected in danger

### MEDIUM

An incident requiring attention.

Examples:

- Multiple vehicles involved
- Person detected near the accident
- More important collision

### HIGH

A serious accident requiring immediate intervention.

Examples:

- Multiple people involved
- Vehicle overturned
- Fire detected
- Major collision

For the MVP, severity can initially be calculated using predefined rules.

---

## Accident Detection

The system analyzes video footage using an AI model.

Possible detected elements include:

```text
car
truck
motorcycle
person
accident
```

The AI does not immediately create an alert after a single detection.

Several consecutive frames must confirm the accident. The 10 second videos before and after the accident is sent to the responsible authority based on intelligent calculation.

Example:

```text
Frame 1 → Accident detected
Frame 2 → Accident detected
Frame 3 → Accident detected

→ Accident confirmed
```

This helps reduce false alarms.

---

## Incident Data

An accident event can contain:

```json
{
  "type": "traffic_accident",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "severity": "MEDIUM",
  "confidence": 0.91,
  "vehicles": 2,
  "people": 1
}
```

---

## Dashboard

The web dashboard allows users to:

- View current incidents
- See incident severity
- See accident location
- View accident history
- Display statistics
- Follow the status of incidents

Example:

```text
Accident detected

Severity: HIGH
Vehicles involved: 3
People detected: 2
Confidence: 92%
Status: Confirmed
```

---

## Map

The map displays detected incidents using Leaflet and OpenStreetMap.

Each accident is represented by a marker.

Example:

```text
LOW     → Green
MEDIUM  → Orange
HIGH    → Red
```

For the MVP, GPS coordinates can be simulated.

---

## Personas

The system is designed for several types of users.

| Persona | Main Need | Proposed Solution |
|---|---|---|
| Driver | Be informed quickly about incidents | Map showing current incidents and traffic information |
| Emergency services | Receive precise information quickly | Alert containing location and severity |
| Police / municipal services | Monitor incidents and traffic | Dashboard for incident monitoring |
| City | Identify high-risk areas | Incident history and statistics |

---

## Project Structure

```text
NexoraSafeRoad/
│
├── ai/
│   ├── model/            # YOLO weights (not committed)
│   ├── main.py           # entry point: python -m ai.main --source <video>
│   ├── camera.py
│   ├── detector.py       # YOLO detection + multi-frame confirmation
│   ├── severity.py
│   ├── clip_recorder.py  # 10 s before/after clips
│   ├── alerts.py         # simulated alerts + POST to backend
│   ├── tests/
│   └── requirements.txt
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   └── routes/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── services/
│
├── dataset/
│
├── docker-compose.yml
│
└── README.md
```

---

## Development Workflow

The project is developed using Git and GitHub.

Main branch:

```text
main
```

Example feature branches:

```text
feature/project-start
feature/ai-detection
feature/dashboard
feature/map
feature/backend-api
```

Recommended workflow:

```text
feature branch
      ↓
development
      ↓
commit
      ↓
push
      ↓
pull request
      ↓
main
```

---

## Dataset

The AI model will be trained using road traffic images and accident images.

The dataset should contain:

- Normal traffic
- Car accidents
- Motorcycle accidents
- Multiple vehicle accidents
- Day scenes
- Night scenes
- Different weather conditions
- Different camera angles

Including normal traffic images is important to reduce false detections.

---

## Future Improvements

Possible improvements after the MVP:

- Real CCTV integration
- Real-time emergency notifications
- Automatic emergency service routing
- More advanced severity prediction
- Traffic prediction
- Dangerous-zone detection
- Accident heatmaps
- Mobile application
- Real GPS integration
- Real-time WebSocket notifications
- Automatic accident reports

---

## Authors

Project developed by the  team 12 as part of the EFREI DataCity / SafeCity project.



---

## Status

```text
Project Status: MVP / Development
```

Current priority:

```text
Video → Detection → Severity → API → Dashboard → Map
```