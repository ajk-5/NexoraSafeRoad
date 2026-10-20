import { ALERT_STATUS_LABELS, INCIDENT_STATUS_LABELS, OPERATOR_STATUS_LABELS, TRAINING_STATUS_LABELS } from "../labels";
import type { AlertStatus, IncidentStatus, OperatorStatus, Severity, TrainingStatus } from "../types/api";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge severity-${severity.toLowerCase()}`}>{severity}</span>;
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge status status-${status.toLowerCase()}`}>{INCIDENT_STATUS_LABELS[status]}</span>;
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <span className={`badge status alert-${status.toLowerCase()}`}>{ALERT_STATUS_LABELS[status]}</span>;
}

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  return (
    <span className={`operator-status operator-${status.toLowerCase()}`}>
      <span className="dot" aria-hidden="true" />
      {OPERATOR_STATUS_LABELS[status]}
    </span>
  );
}

export function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return <span className={`badge status training-${status.toLowerCase()}`}>{TRAINING_STATUS_LABELS[status]}</span>;
}
