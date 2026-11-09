// Backend-shaped objects for tests, with sensible defaults to override.
import type { Alert, Incident, IncidentAlert, Operator } from "../types/api";

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  const id = overrides.id ?? 1;
  return {
    id,
    reference: `INC-${1000 + id}`,
    cameraId: "cam-01",
    latitude: 48.8566,
    longitude: 2.3522,
    location: "A7 - KM 32.4",
    severity: "HIGH",
    confidence: 0.87,
    vehicles: 3,
    people: 1,
    possibleInjuries: true,
    fire: false,
    overturned: false,
    videoUrl: "/media/INC-1001.mp4",
    status: "UNDER_REVIEW",
    detectedAt: "2026-10-20T10:00:00Z",
    confirmedAt: null,
    decidedAt: null,
    resolvedAt: null,
    assignedAdmin: "Admin 1",
    canEdit: true,
    suggestedServices: [
      { service: "POLICE", reason: "Secure the scene and manage traffic" },
      { service: "AMBULANCE", reason: "1 person on the scene: possible injuries" },
    ],
    selectedServices: ["POLICE", "AMBULANCE"],
    selectedStations: {},
    alerts: [],
    ...overrides,
  };
}

export function makeIncidentAlert(overrides: Partial<IncidentAlert> = {}): IncidentAlert {
  return {
    id: 1,
    serviceType: "POLICE",
    status: "SENT",
    assignedOperator: null,
    station: null,
    sentAt: "2026-10-20T10:05:00Z",
    acceptedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    incidentId: 1,
    incidentReference: "INC-1001",
    serviceType: "POLICE",
    status: "SENT",
    severity: "HIGH",
    location: "A7 - KM 32.4",
    latitude: 48.8566,
    longitude: 2.3522,
    vehicles: 3,
    possibleInjuries: true,
    assignedOperator: null,
    station: null,
    sentAt: "2026-10-20T10:05:00Z",
    acceptedAt: null,
    resolvedAt: null,
    canAccept: true,
    canUpdate: false,
    ...overrides,
  };
}

export function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: 1,
    username: "admin1",
    displayName: "Admin 1",
    role: "ADMIN",
    status: "ACTIVE",
    lastSeenAt: "2026-10-20T10:00:00Z",
    currentIncidentId: null,
    ...overrides,
  };
}
