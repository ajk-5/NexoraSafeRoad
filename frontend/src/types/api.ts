// Shapes of the backend's JSON (see backend/schemas). Dates are ISO 8601 strings in UTC.

export type Role = "ADMIN" | "POLICE" | "AMBULANCE" | "POMPIERS" | "DEPANNAGE";
export type ServiceType = Exclude<Role, "ADMIN">;
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
/** Statuses a service operator can move an accepted alert to. */
export type AlertUpdate = Extract<AlertStatus, "EN_ROUTE" | "ON_SCENE" | "RESOLVED">;

export interface Operator {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  status: OperatorStatus;
  lastSeenAt: string | null;
  /** Incident under review (admin) or current intervention (service operator). */
  currentIncidentId: number | null;
}

export interface LoginResponse {
  token: string;
  operator: Operator;
}

export interface SuggestedService {
  service: ServiceType;
  reason: string;
}

/** An emergency station and how far it is from the incident. */
export interface Station {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** Straight-line distance to the incident. */
  distanceM: number;
  /** Rough driving estimate, not a route. */
  etaMinutes: number;
}

export interface ServiceStations {
  service: ServiceType;
  /** Nearest first. */
  stations: Station[];
}

/** The station picked for each service, by station id. */
export type StationChoice = Partial<Record<ServiceType, string>>;

export interface IncidentAlert {
  id: number;
  serviceType: ServiceType;
  status: AlertStatus;
  assignedOperator: string | null;
  /** The station called; null when the backend had no station data. */
  station: Station | null;
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
  /** False means read-only for the signed-in operator. */
  canEdit: boolean;
  suggestedServices: SuggestedService[];
  selectedServices: ServiceType[];
  /** Stations the admin picked so far; a selected service without one gets its nearest. */
  selectedStations: StationChoice;
  alerts: IncidentAlert[];
}

export interface Alert {
  id: number;
  incidentId: number;
  incidentReference: string;
  serviceType: ServiceType;
  status: AlertStatus;
  severity: Severity;
  location: string | null;
  latitude: number;
  longitude: number;
  vehicles: number;
  possibleInjuries: boolean;
  assignedOperator: string | null;
  station: Station | null;
  sentAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
  canAccept: boolean;
  canUpdate: boolean;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface Statistics {
  totalIncidents: number;
  resolvedIncidents: number;
  incidentsByStatus: Record<IncidentStatus, number>;
  incidentsBySeverity: Record<Severity, number>;
  incidentsByCamera: Record<string, number>;
  incidentsPerDay: DayCount[];
  alertsByService: Record<ServiceType, number>;
  averageResponseSeconds: number | null;
  operatorsByStatus: Record<OperatorStatus, number>;
}

// ---- AI training platform (admin "AI Training" page) ----

export type ModelSource = "PRETRAINED" | "TRAINED";
export type TrainingStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type BaseCheckpoint = "yolo11n.pt" | "yolo11s.pt" | "yolo11m.pt" | "yolo11l.pt" | "yolo11x.pt";

export interface TrainingDataset {
  id: number;
  name: string;
  sizeBytes: number;
  classNames: string[];
  /** The classes the accident detector reacts to (accident, fire, overturned...). */
  detectorClasses: string[];
  trainImages: number;
  valImages: number;
  testImages: number;
  createdAt: string;
}

export interface AIModel {
  id: number;
  name: string;
  source: ModelSource;
  sha256: string;
  sizeBytes: number | null;
  classNames: string[];
  map50: number | null;
  map50_95: number | null;
  precision: number | null;
  recall: number | null;
  /** Where the metrics come from. */
  metricsNote: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EpochMetrics {
  epoch: number;
  precision: number | null;
  recall: number | null;
  map50: number | null;
  map50_95: number | null;
  boxLoss: number | null;
  clsLoss: number | null;
}

export interface TrainingJob {
  id: number;
  status: TrainingStatus;
  dataset: { id: number; name: string };
  baseName: string;
  epochs: number;
  imageSize: number;
  batch: number;
  useFalseAlarms: boolean;
  useConfirmed: boolean;
  currentEpoch: number;
  history: EpochMetrics[];
  /** Metrics of the best weights, measured after the last epoch. */
  finalMetrics: EpochMetrics | null;
  /** Only in the job detail. */
  log: string | null;
  error: string | null;
  cancelRequested: boolean;
  workerName: string | null;
  resultModelId: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TrainingJobRequest {
  datasetId: number;
  baseModelId?: number;
  baseCheckpoint?: BaseCheckpoint;
  epochs: number;
  imageSize: number;
  batch: number;
  useFalseAlarms: boolean;
  useConfirmed: boolean;
}

export interface TrainingOverview {
  worker: { name: string; device: string; lastSeenAt: string; online: boolean } | null;
  activeModel: AIModel | null;
  queuedJobs: number;
  runningJobs: number;
  /** Reviewed incidents with a clip: declined ones are false alarms. */
  feedback: { falseAlarms: number; confirmed: number };
}
