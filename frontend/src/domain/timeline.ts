// The incident's history, built only from timestamps the backend recorded. Steps that have no
// recorded time (e.g. "en route") appear as the current state, never with an invented time.
import { percent } from "../format";
import { ALERT_STATUS_LABELS, SERVICE_SHORT_LABELS } from "../labels";
import type { Incident } from "../types/api";

export type TimelineTone = "ai" | "operator" | "service" | "rejected" | "done" | "pending";

export interface TimelineEvent {
  key: string;
  /** ISO time; null for the current, still pending step. */
  at: string | null;
  title: string;
  detail?: string;
  tone: TimelineTone;
}

export function buildTimeline(incident: Incident): TimelineEvent[] {
  const by = incident.assignedAdmin ? `by ${incident.assignedAdmin}` : undefined;
  const events: TimelineEvent[] = [
    {
      key: "detected",
      at: incident.detectedAt,
      title: "Detected by the AI",
      detail: `Camera ${incident.cameraId} · ${percent(incident.confidence)} model confidence`,
      tone: "ai",
    },
  ];
  if (incident.confirmedAt) {
    events.push({ key: "confirmed", at: incident.confirmedAt, title: "Confirmed as a real accident", detail: by, tone: "operator" });
  }
  if (incident.status === "DECLINED" && incident.decidedAt) {
    events.push({ key: "declined", at: incident.decidedAt, title: "Rejected as a false alarm", detail: by, tone: "rejected" });
  }
  if (incident.alerts.length > 0 && incident.decidedAt) {
    const services = incident.alerts.map((a) => SERVICE_SHORT_LABELS[a.serviceType]).join(", ");
    events.push({
      key: "sent",
      at: incident.decidedAt,
      title: "Alert sent",
      detail: [`To ${services}`, by].filter(Boolean).join(" · "),
      tone: "operator",
    });
  }
  for (const alert of incident.alerts) {
    const service = SERVICE_SHORT_LABELS[alert.serviceType];
    if (alert.acceptedAt) {
      events.push({
        key: `accepted-${alert.id}`,
        at: alert.acceptedAt,
        title: `${service} accepted`,
        detail: alert.assignedOperator ? `by ${alert.assignedOperator}` : undefined,
        tone: "service",
      });
    }
    if (alert.resolvedAt) {
      events.push({ key: `resolved-${alert.id}`, at: alert.resolvedAt, title: `${service} resolved`, tone: "service" });
    }
  }
  if (incident.status === "RESOLVED" && incident.resolvedAt) {
    events.push({ key: "resolved", at: incident.resolvedAt, title: "Incident resolved", tone: "done" });
  }

  // Stable sort: events at the same time keep the order above.
  const timed = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Date.parse(a.event.at ?? "") - Date.parse(b.event.at ?? "") || a.index - b.index)
    .map(({ event }) => event);
  return [...timed, ...pendingSteps(incident)];
}

/** What is happening now, without a time. */
function pendingSteps(incident: Incident): TimelineEvent[] {
  const operator = incident.assignedAdmin ?? "an operator";
  switch (incident.status) {
    case "DETECTED":
    case "WAITING_FOR_OPERATOR":
      return [{ key: "now", at: null, title: "Waiting for an available operator", tone: "pending" }];
    case "ASSIGNED":
      return [{ key: "now", at: null, title: `Assigned to ${operator}`, detail: "Not opened yet", tone: "pending" }];
    case "UNDER_REVIEW":
      return [{ key: "now", at: null, title: `Being reviewed by ${operator}`, tone: "pending" }];
    case "ALERT_SENT":
    case "IN_PROGRESS":
      return incident.alerts
        .filter((a) => a.status !== "RESOLVED")
        .map((a) => ({
          key: `now-${a.id}`,
          at: null,
          title: `${SERVICE_SHORT_LABELS[a.serviceType]}: ${a.status === "SENT" ? "waiting for an operator to accept" : ALERT_STATUS_LABELS[a.status].toLowerCase()}`,
          tone: "pending" as const,
        }));
    default:
      return [];
  }
}
