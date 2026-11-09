import {
  ALERT_STATUS_LABELS,
  INCIDENT_STATUS_HELP,
  INCIDENT_STATUS_LABELS,
  OPERATOR_STATUS_HELP,
  OPERATOR_STATUS_LABELS,
  SEVERITY_LABELS,
  TRAINING_STATUS_LABELS,
} from "../labels";
import type { AlertStatus, IncidentStatus, OperatorStatus, Severity, TrainingStatus } from "../types/api";
import { Icon } from "./Icon";

const BARS: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Severity as a word plus 1-3 bars, so it never depends on colour alone. */
export function SeverityBadge({ severity, large = false }: { severity: Severity; large?: boolean }) {
  return (
    <span className={`badge sev-badge sev-${severity.toLowerCase()}${large ? " lg" : ""}`}>
      <span className="sev-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= BARS[severity] ? "on" : undefined} />
        ))}
      </span>
      {SEVERITY_LABELS[severity]}
      <span className="visually-hidden"> severity</span>
    </span>
  );
}

type Tone = "waiting" | "review" | "sent" | "progress" | "done" | "closed";

const INCIDENT_TONES: Record<IncidentStatus, Tone> = {
  DETECTED: "waiting",
  WAITING_FOR_OPERATOR: "waiting",
  ASSIGNED: "review",
  UNDER_REVIEW: "review",
  ALERT_SENT: "sent",
  IN_PROGRESS: "progress",
  RESOLVED: "done",
  DECLINED: "closed",
};

const ALERT_TONES: Record<AlertStatus, Tone> = {
  SENT: "waiting",
  ACCEPTED: "progress",
  EN_ROUTE: "progress",
  ON_SCENE: "progress",
  RESOLVED: "done",
};

const TRAINING_TONES: Record<TrainingStatus, Tone> = {
  QUEUED: "waiting",
  RUNNING: "review",
  COMPLETED: "done",
  FAILED: "closed",
  CANCELLED: "closed",
};

function StatusPill({ tone, label, title, large }: { tone: Tone; label: string; title?: string; large?: boolean }) {
  return (
    <span className={`badge status-badge tone-${tone}${large ? " lg" : ""}`} title={title}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function IncidentStatusBadge({ status, large }: { status: IncidentStatus; large?: boolean }) {
  return (
    <StatusPill tone={INCIDENT_TONES[status]} label={INCIDENT_STATUS_LABELS[status]} title={INCIDENT_STATUS_HELP[status]} large={large} />
  );
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <StatusPill tone={ALERT_TONES[status]} label={ALERT_STATUS_LABELS[status]} />;
}

export function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return <StatusPill tone={TRAINING_TONES[status]} label={TRAINING_STATUS_LABELS[status]} />;
}

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  return (
    <span className={`op-status op-${status.toLowerCase()}`} title={OPERATOR_STATUS_HELP[status]}>
      <span className="dot" aria-hidden="true" />
      {OPERATOR_STATUS_LABELS[status]}
    </span>
  );
}

/** Marks information that comes from the AI and has not been verified by a person. */
export function AiTag({ children = "AI" }: { children?: string }) {
  return (
    <span className="ai-tag">
      <Icon name="sparkles" size="sm" />
      {children}
    </span>
  );
}
