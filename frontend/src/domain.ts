export const ROLES = ["ADMIN", "POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"] as const;
export type Role = (typeof ROLES)[number];
export type Service = Exclude<Role, "ADMIN">;
export type OperatorStatus = "ACTIVE" | "BUSY" | "PAUSED" | "OFFLINE";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type IncidentStatus =
  | "DETECTED"
  | "WAITING_FOR_OPERATOR"
  | "ASSIGNED"
  | "UNDER_REVIEW"
  | "ALERT_SENT"
  | "DECLINED"
  | "IN_PROGRESS"
  | "RESOLVED";
export type AlertStatus = "SENT" | "ACCEPTED" | "EN_ROUTE" | "ON_SCENE" | "RESOLVED";

export interface Operator {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  status: OperatorStatus;
  lastSeenAt: string | null;
  currentIncidentId: number | null;
}

export interface Session {
  token: string;
  operator: Operator;
}

export interface SuggestedService {
  service: Service;
  reason: string;
}

export interface IncidentAlert {
  id: number;
  serviceType: Service;
  status: AlertStatus;
  assignedOperator: string | null;
  sentAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
}

export interface Incident {
  id: number;
  reference: string;
  cameraId: string;
  latitude: number;
  longitude: number;
  location: string | null;
  severity: Severity;
  confidence: number;
  vehicles: number;
  people: number;
  possibleInjuries: boolean;
  fire: boolean;
  overturned: boolean;
  videoUrl: string | null;
  status: IncidentStatus;
  detectedAt: string;
  decidedAt: string | null;
  resolvedAt: string | null;
  assignedAdmin: string | null;
  canEdit: boolean;
  suggestedServices: SuggestedService[];
  selectedServices: Service[];
  alerts: IncidentAlert[];
}

export interface Alert {
  id: number;
  incidentId: number;
  incidentReference: string;
  serviceType: Service;
  status: AlertStatus;
  severity: Severity;
  location: string | null;
  latitude: number;
  longitude: number;
  vehicles: number;
  possibleInjuries: boolean;
  assignedOperator: string | null;
  sentAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
  canAccept: boolean;
  canUpdate: boolean;
}

export interface Statistics {
  totalIncidents: number;
  resolvedIncidents: number;
  incidentsByStatus: Partial<Record<IncidentStatus, number>>;
  incidentsBySeverity: Partial<Record<Severity, number>>;
  incidentsByCamera: Record<string, number>;
  incidentsPerDay: { date: string; count: number }[];
  alertsByService: Partial<Record<Service, number>>;
  averageResponseSeconds: number | null;
  operatorsByStatus: Partial<Record<OperatorStatus, number>>;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Control room",
  POLICE: "Police",
  AMBULANCE: "Ambulance",
  POMPIERS: "Fire & rescue",
  DEPANNAGE: "Roadside assistance",
};

export const STATUS_LABEL: Record<string, string> = {
  DETECTED: "Detected",
  WAITING_FOR_OPERATOR: "Waiting for operator",
  ASSIGNED: "Assigned",
  UNDER_REVIEW: "Under review",
  ALERT_SENT: "Alert sent",
  DECLINED: "Declined",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  SENT: "Awaiting acceptance",
  ACCEPTED: "Accepted",
  EN_ROUTE: "En route",
  ON_SCENE: "On scene",
  ACTIVE: "Available",
  BUSY: "Busy",
  PAUSED: "Paused",
  OFFLINE: "Offline",
};

export function displayDate(value: string | null | undefined, includeTime = true): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function roleHome(role: Role): string {
  return role === "ADMIN" ? "/admin/dashboard" : "/operator/dashboard";
}

export function apiMediaUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
