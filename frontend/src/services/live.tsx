import { createContext, useContext, type ReactNode } from "react";

import type { Alert, Incident, Operator } from "../types/api";
import { api } from "./api";
import { usePolling, type Polled } from "./usePolling";

/**
 * The incidents (and, for service operators, alerts) every page of an area shares: the queue,
 * the map, the header notifications and the lists all read the same poll, so they never disagree
 * and the backend is asked once every 5 s instead of once per component.
 */
interface Live {
  incidents: Polled<Incident[]>;
  /** Service operators only; always empty for admins and the super admin. */
  alerts: Polled<Alert[]>;
}

const LiveContext = createContext<Live | null>(null);

const NO_ALERTS: Promise<Alert[]> = Promise.resolve([]);

export function LiveDataProvider({ operator, children }: { operator: Operator; children: ReactNode }) {
  // Only service operators work from alerts; admins and the super admin work from incidents.
  const isAdmin = operator.role === "ADMIN" || operator.role === "SUPERADMIN";
  // Polled again when the operator's work changes (e.g. a new incident was assigned to them),
  // so the queue reflects it without waiting for the next tick.
  const incidents = usePolling(() => api.incidents(), [operator.id, operator.currentIncidentId]);
  const alerts = usePolling(() => (isAdmin ? NO_ALERTS : api.alerts()), [operator.id, isAdmin, operator.currentIncidentId]);
  return <LiveContext.Provider value={{ incidents, alerts }}>{children}</LiveContext.Provider>;
}

export function useLive(): Live {
  const live = useContext(LiveContext);
  if (live === null) throw new Error("useLive must be used inside <LiveDataProvider>");
  return live;
}
