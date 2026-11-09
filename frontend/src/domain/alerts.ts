// The service operator's queue: alerts sent to their service (Police, Ambulance...).
import type { Alert, Operator } from "../types/api";
import { SEVERITY_RANK } from "./incidents";

export type AlertFilter = "new" | "mine" | "all";

export const ALERT_FILTERS: AlertFilter[] = ["new", "mine", "all"];

export const ALERT_FILTER_LABELS: Record<AlertFilter, string> = { new: "New", mine: "Mine", all: "All" };

/** Accepted by me, whether still running or resolved. */
export function isMyAlert(alert: Alert, operator: Pick<Operator, "displayName">): boolean {
  return alert.canUpdate || (alert.assignedOperator !== null && alert.assignedOperator === operator.displayName);
}

export function matchesAlertFilter(alert: Alert, filter: AlertFilter, operator: Pick<Operator, "displayName">): boolean {
  if (filter === "new") return alert.status === "SENT";
  if (filter === "mine") return isMyAlert(alert, operator);
  return true;
}

/** A filter from the address bar, or null if it is not one. */
export function parseAlertFilter(value: string | null): AlertFilter | null {
  return ALERT_FILTERS.find((filter) => filter === value) ?? null;
}

/** My running intervention first, then new alerts (most severe, then waiting longest), then the rest, newest first. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  const rank = (a: Alert) => (a.canUpdate ? 0 : a.status === "SENT" ? 1 : 2);
  return [...alerts].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (rank(a) === 1) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || Date.parse(a.sentAt) - Date.parse(b.sentAt);
    return Date.parse(b.sentAt) - Date.parse(a.sentAt);
  });
}
