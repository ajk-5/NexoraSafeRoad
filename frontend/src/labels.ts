// Operator-facing wording for the backend's codes (README "UI / UX Principles": clear labels).
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

export const ROLES: Role[] = ["ADMIN", "POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"];
export const SERVICES: ServiceType[] = ["POLICE", "AMBULANCE", "POMPIERS", "DEPANNAGE"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  POLICE: "Police",
  AMBULANCE: "Ambulance",
  POMPIERS: "Pompiers",
  DEPANNAGE: "Dépannage",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  POLICE: "Police",
  AMBULANCE: "Ambulance / SAMU",
  POMPIERS: "Pompiers",
  DEPANNAGE: "Dépannage",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  DETECTED: "Detected",
  WAITING_FOR_OPERATOR: "Waiting for operator",
  ASSIGNED: "Assigned",
  UNDER_REVIEW: "Under review",
  ALERT_SENT: "Alert sent",
  DECLINED: "Declined",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
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

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  SENT: "New",
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
  ACTIVE: "Active",
  BUSY: "Busy",
  PAUSED: "Paused",
  OFFLINE: "Offline",
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

export const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH"];
/** Also used by the CSS badges (see styles.css --high, --medium, --low). */
export const SEVERITY_COLORS: Record<Severity, string> = { HIGH: "#dc2626", MEDIUM: "#ea580c", LOW: "#ca8a04" };

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
