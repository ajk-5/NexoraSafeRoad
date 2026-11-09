import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Alert, Incident, Operator } from "../types/api";
import { api, sessionToken } from "./api";
import { useAuth } from "./auth";
import { connectLive } from "./socket";
import { usePolling, type Polled } from "./usePolling";

/**
 * The incidents (and, for service operators, alerts) every page of an area shares: the queue,
 * the map, header notifications and lists share one cache. WebSocket change messages refresh
 * it immediately, including in background tabs; polling provides a fallback.
 */
interface Live {
  connected: boolean;
  incidents: Polled<Incident[]>;
  /** Service operators only; always empty for admins and the super admin. */
  alerts: Polled<Alert[]>;
}

const LiveContext = createContext<Live | null>(null);

const NO_ALERTS: Promise<Alert[]> = Promise.resolve([]);

export function LiveDataProvider({ operator, children }: { operator: Operator; children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const { update } = useAuth();
  // Only service operators work from alerts; admins and the super admin work from incidents.
  const isAdmin = operator.role === "ADMIN" || operator.role === "SUPERADMIN";
  // Polled again when the operator's work changes (e.g. a new incident was assigned to them),
  // so the queue reflects it without waiting for the next tick.
  const incidents = usePolling(() => api.incidents(), [operator.id, operator.currentIncidentId]);
  const alerts = usePolling(() => (isAdmin ? NO_ALERTS : api.alerts()), [operator.id, isAdmin, operator.currentIncidentId]);
  useEffect(() => {
    const token = sessionToken();
    if (!token) return;
    return connectLive(token, () => {
      incidents.reload();
      alerts.reload();
      void api.me().then(update, () => {});
    }, setConnected);
  }, [operator.id, incidents.reload, alerts.reload, update]);
  return <LiveContext.Provider value={{ incidents, alerts, connected }}>{children}</LiveContext.Provider>;
}

export function useLive(): Live {
  const live = useContext(LiveContext);
  if (live === null) throw new Error("useLive must be used inside <LiveDataProvider>");
  return live;
}
