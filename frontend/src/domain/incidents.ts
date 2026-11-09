// What the console derives from an incident: its title, where it sits in the queue, and which
// decision the signed-in admin can take. Pure functions, so the rules are easy to test.
import { INCIDENT_STATUS_LABELS, LOCKED_STATUSES, OPEN_INCIDENT_STATUSES, UNDECIDED_STATUSES } from "../labels";
import type { Incident, Operator, Severity } from "../types/api";

export const SEVERITY_RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function isOpen(incident: Pick<Incident, "status">): boolean {
  return OPEN_INCIDENT_STATUSES.includes(incident.status);
}

export function isUndecided(incident: Pick<Incident, "status">): boolean {
  return UNDECIDED_STATUSES.includes(incident.status);
}

/** An admin (not the AI) said this is a real accident: confirmed, or services were alerted. */
export function isConfirmed(incident: Pick<Incident, "confirmedAt" | "status">): boolean {
  return incident.confirmedAt !== null || ["ALERT_SENT", "IN_PROGRESS", "RESOLVED"].includes(incident.status);
}

/** Locked to the signed-in admin, or decided by them and still open. */
export function isMine(incident: Incident, operator: Pick<Operator, "displayName">): boolean {
  return incident.canEdit || (incident.assignedAdmin !== null && incident.assignedAdmin === operator.displayName);
}

/**
 * A plain-language title from what the AI counted, e.g. "Possible collision · 3 vehicles".
 * "Possible" stays until an admin confirms it: until then it is only the AI's suspicion.
 */
export function incidentTitle(incident: Incident): string {
  return capitalize(`${isConfirmed(incident) ? "" : "Possible "}${incidentKind(incident)}`);
}

/** What the AI predicts, always worded as a possibility: it never becomes a fact by itself. */
export function aiPrediction(incident: Pick<Incident, "vehicles" | "fire" | "overturned">): string {
  return `Possible ${incidentKind(incident)}`;
}

function incidentKind({ vehicles, fire, overturned }: Pick<Incident, "vehicles" | "fire" | "overturned">): string {
  if (fire) return "accident with a vehicle fire";
  if (overturned) return "accident with an overturned vehicle";
  if (vehicles >= 2) return `collision · ${vehicles} vehicles`;
  return vehicles === 1 ? "accident · 1 vehicle" : "road accident";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Why the AI flags possible injuries (backend `possible_injuries`), or null when it does not. */
export function injuryFlagReason(incident: Pick<Incident, "people" | "fire" | "overturned">): string | null {
  const reasons = [
    incident.people > 0 && (incident.people === 1 ? "a person is visible" : `${incident.people} people are visible`),
    incident.fire && "a vehicle is on fire",
    incident.overturned && "a vehicle is overturned",
  ].filter((reason): reason is string => typeof reason === "string");
  return reasons.length === 0 ? null : capitalize(`${joinAnd(reasons)}.`);
}

// ---- The incident queue (admin dashboard) ----

export type QueueFilter = "all" | "waiting" | "mine" | "high";
export type QueueOrder = "priority" | "newest";

export const QUEUE_FILTER_LABELS: Record<QueueFilter, string> = {
  all: "All",
  waiting: "Waiting",
  mine: "Mine",
  high: "High",
};

export function matchesQueueFilter(incident: Incident, filter: QueueFilter, operator: Pick<Operator, "displayName">): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return incident.status === "WAITING_FOR_OPERATOR" || incident.status === "DETECTED";
    case "mine":
      return isMine(incident, operator);
    case "high":
      return incident.severity === "HIGH";
  }
}

/**
 * Open incidents in queue order. "priority": the incident locked to me first, then the ones still
 * to decide before those already with services, then most severe, then waiting longest.
 * "newest": the actual chronological order, newest first.
 */
export function sortQueue(incidents: Incident[], order: QueueOrder): Incident[] {
  const byTime = (a: Incident, b: Incident) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt) || a.id - b.id;
  if (order === "newest") return [...incidents].sort((a, b) => byTime(b, a));
  return [...incidents].sort(
    (a, b) =>
      Number(b.canEdit) - Number(a.canEdit) ||
      Number(isUndecided(b)) - Number(isUndecided(a)) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      byTime(a, b),
  );
}

export function matchesSearch(incident: Incident, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return [incident.reference, incident.location ?? "", incident.cameraId, incident.assignedAdmin ?? "", INCIDENT_STATUS_LABELS[incident.status]]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

// ---- The decision the signed-in admin can take ----

export type ReviewStage =
  /** Nobody holds it yet; the backend assigns it to the next available admin. */
  | { kind: "waiting" }
  /** Another admin holds the lock. */
  | { kind: "readOnly"; by: string | null }
  /** Mine: watch the clip, then confirm a real accident or reject a false alarm. */
  | { kind: "verify" }
  /** Mine and confirmed: choose the services, then send the alert. */
  | { kind: "dispatch" }
  /** Alert sent, rejected or resolved: nothing left to decide. */
  | { kind: "decided" };

export function reviewStage(incident: Incident): ReviewStage {
  if (!isUndecided(incident)) return { kind: "decided" };
  if (!LOCKED_STATUSES.includes(incident.status)) return { kind: "waiting" };
  if (!incident.canEdit) return { kind: "readOnly", by: incident.assignedAdmin };
  return incident.confirmedAt === null ? { kind: "verify" } : { kind: "dispatch" };
}

export type ReviewAction = "confirm" | "reject" | "save" | "dispatch";

/** Only the actions valid in this state, for this admin. Dispatch needs a confirmed incident. */
export function reviewActions(stage: ReviewStage): ReviewAction[] {
  if (stage.kind === "verify") return ["confirm", "reject"];
  if (stage.kind === "dispatch") return ["dispatch", "save", "reject"];
  return [];
}

// ---- Why the AI rated it this severe (mirrors ai/severity.py) ----

/**
 * The rule that gave this severity, in words, e.g. "High: the AI counted 3 vehicles.".
 * Null when the counts do not give the stored severity (another rule version made it).
 */
export function severityExplanation(incident: Pick<Incident, "vehicles" | "people" | "fire" | "overturned" | "severity">): string | null {
  const { vehicles, people, fire, overturned } = incident;
  const high = [
    fire && "a vehicle fire",
    overturned && "an overturned vehicle",
    people >= 2 && `${people} people`,
    vehicles >= 3 && `${vehicles} vehicles`,
  ].filter((reason): reason is string => typeof reason === "string");
  const medium = [vehicles >= 2 && `${vehicles} vehicles`, people >= 1 && `${people} person`].filter(
    (reason): reason is string => typeof reason === "string",
  );
  const computed: Severity = high.length > 0 ? "HIGH" : medium.length > 0 ? "MEDIUM" : "LOW";
  if (computed !== incident.severity) return null;
  if (computed === "HIGH") return `High: the AI saw ${joinAnd(high)}.`;
  if (computed === "MEDIUM") return `Medium: the AI saw ${joinAnd(medium)}.`;
  return `Low: the AI saw ${vehicles === 1 ? "one vehicle and no people" : "no vehicles or people"}.`;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
}
