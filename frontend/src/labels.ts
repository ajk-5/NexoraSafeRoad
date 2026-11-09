// Operator-facing wording for the backend's codes. The codes themselves never change; only what
// people read does. Keep the same word for the same thing on every screen.
import type {
  AlertStatus,
  AlertUpdate,
  BaseCheckpoint,
  IncidentStatus,
  OperatorStatus,
  Role,
  ServiceType,
  Severity,
  TrainingStatus,
} from "./types/api";

export const ROLES: Role[] = ["ADMIN", "POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE", "SUPERADMIN"];
export const SERVICES: ServiceType[] = ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"];

/** The emergency service a role works for, or null for admins and the super admin. */
export function serviceOf(role: Role): ServiceType | null {
  return SERVICES.find((service) => service === role) ?? null;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Super admin",
  ADMIN: "Admin",
  POLICE: "Police",
  AMBULANCE: "Ambulance",
  POMPIERS: "Firefighters",
  DEPANNAGE: "Road assistance",
};

/** What each role does, for the sign-in screen. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPERADMIN: "Manage accounts, train the AI and follow the statistics",
  ADMIN: "Review AI detections and dispatch services",
  POLICE: "Receive police alerts",
  AMBULANCE: "Receive ambulance / SAMU alerts",
  POMPIERS: "Receive firefighter alerts",
  DEPANNAGE: "Receive road assistance alerts",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  POLICE: "Police",
  AMBULANCE: "Ambulance (SAMU)",
  POMPIERS: "Firefighters (Pompiers)",
  DEPANNAGE: "Road assistance (Dépannage)",
};

/** Short names where space is tight (map tags, chips). */
export const SERVICE_SHORT_LABELS: Record<ServiceType, string> = {
  POLICE: "Police",
  AMBULANCE: "Ambulance",
  POMPIERS: "Firefighters",
  DEPANNAGE: "Road assistance",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  DETECTED: "Detected",
  WAITING_FOR_OPERATOR: "Waiting for review",
  ASSIGNED: "Assigned",
  UNDER_REVIEW: "Being reviewed",
  ALERT_SENT: "Alert sent",
  DECLINED: "Rejected / False alarm",
  IN_PROGRESS: "Services responding",
  RESOLVED: "Resolved",
};

/** One sentence per status, for tooltips and the incident summary. */
export const INCIDENT_STATUS_HELP: Record<IncidentStatus, string> = {
  DETECTED: "The AI reported a possible accident.",
  WAITING_FOR_OPERATOR: "No admin is available yet. It goes to the next available admin automatically.",
  ASSIGNED: "Assigned to an admin, who has not opened it yet.",
  UNDER_REVIEW: "An admin is watching the clip and deciding.",
  ALERT_SENT: "Services were alerted. Waiting for a service operator to accept.",
  DECLINED: "An admin rejected it as a false alarm. No service was alerted.",
  IN_PROGRESS: "At least one service operator accepted the alert and is responding.",
  RESOLVED: "Every alerted service marked its intervention resolved.",
};

/** Incidents still needing attention (shown on maps and dashboards). */
export const OPEN_INCIDENT_STATUSES: IncidentStatus[] = [
  "DETECTED",
  "WAITING_FOR_OPERATOR",
  "ASSIGNED",
  "UNDER_REVIEW",
  "ALERT_SENT",
  "IN_PROGRESS",
];

/** Incidents an admin still has to decide on. */
export const UNDECIDED_STATUSES: IncidentStatus[] = ["DETECTED", "WAITING_FOR_OPERATOR", "ASSIGNED", "UNDER_REVIEW"];

/** Locked to one admin: only they can change it (backend LOCKED_STATUSES). */
export const LOCKED_STATUSES: IncidentStatus[] = ["ASSIGNED", "UNDER_REVIEW"];

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  SENT: "New alert",
  ACCEPTED: "Accepted",
  EN_ROUTE: "En route",
  ON_SCENE: "On scene",
  RESOLVED: "Resolved",
};

export const ALERT_FLOW: AlertStatus[] = ["SENT", "ACCEPTED", "EN_ROUTE", "ON_SCENE", "RESOLVED"];

/** The next step a service operator takes on an accepted intervention. */
export const NEXT_STEP: Partial<Record<AlertStatus, { status: AlertUpdate; label: string }>> = {
  ACCEPTED: { status: "EN_ROUTE", label: "We're en route" },
  EN_ROUTE: { status: "ON_SCENE", label: "We're on scene" },
  ON_SCENE: { status: "RESOLVED", label: "Mark resolved" },
};

export const OPERATOR_STATUS_LABELS: Record<OperatorStatus, string> = {
  ACTIVE: "Available",
  BUSY: "Busy",
  PAUSED: "Paused",
  OFFLINE: "Offline",
};

export const OPERATOR_STATUS_HELP: Record<OperatorStatus, string> = {
  ACTIVE: "Available: new work is assigned to you.",
  BUSY: "Busy: you are handling something. New work comes when you finish.",
  PAUSED: "Paused: you receive no new work.",
  OFFLINE: "Offline: the server has not heard from this session recently.",
};

/** Station markers on the maps: a colour and a short tag per service. */
export const SERVICE_COLORS: Record<ServiceType, string> = {
  POLICE: "#1d4ed8",
  AMBULANCE: "#047857",
  POMPIERS: "#b91c1c",
  DEPANNAGE: "#6d28d9",
};
export const SERVICE_TAGS: Record<ServiceType, string> = {
  POLICE: "POL",
  AMBULANCE: "SAMU",
  POMPIERS: "SP",
  DEPANNAGE: "DÉP",
};

/** Most severe first. */
export const SEVERITIES: Severity[] = ["HIGH", "MEDIUM", "LOW"];
export const SEVERITY_LABELS: Record<Severity, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
/** Map markers and charts; the badges use the matching tokens in styles/tokens.css. */
export const SEVERITY_COLORS: Record<Severity, string> = { HIGH: "#dc2626", MEDIUM: "#ca8a04", LOW: "#15803d" };
/** A letter on map markers, so severity never depends on colour alone. */
export const SEVERITY_LETTERS: Record<Severity, string> = { HIGH: "H", MEDIUM: "M", LOW: "L" };

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Training",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

/** Stock Ultralytics checkpoints (trained on COCO) a job can start from. */
export const STOCK_CHECKPOINTS: { value: BaseCheckpoint; label: string }[] = [
  { value: "yolo11n.pt", label: "YOLO11n (COCO) — fastest" },
  { value: "yolo11s.pt", label: "YOLO11s (COCO)" },
  { value: "yolo11m.pt", label: "YOLO11m (COCO)" },
  { value: "yolo11l.pt", label: "YOLO11l (COCO)" },
  { value: "yolo11x.pt", label: "YOLO11x (COCO) — most accurate" },
];

export const IMAGE_SIZES = [320, 416, 512, 640, 800, 960, 1280];
