import { useState } from "react";
import { Link } from "react-router";

import { AcceptAlertButton } from "../../components/AcceptAlertButton";
import { AlertStatusBadge, SeverityBadge } from "../../components/Badges";
import { IncidentMap } from "../../components/IncidentMap";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { alertDescription, locationLabel, timeAgo } from "../../format";
import { OPEN_INCIDENT_STATUSES, SERVICE_LABELS } from "../../labels";
import { api } from "../../services/api";
import { useOperator } from "../../services/auth";
import { usePolling } from "../../services/usePolling";

/** README "Service Operator Dashboard": only this service's incidents and alerts. */
export function OperatorDashboard() {
  const operator = useOperator();
  const incidents = usePolling(() => api.incidents(), []);
  const alerts = usePolling(() => api.alerts(), []);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const open = (incidents.data ?? []).filter((i) => OPEN_INCIDENT_STATUSES.includes(i.status));
  const current = (alerts.data ?? []).find((a) => a.canUpdate);
  const waiting = (alerts.data ?? []).filter((a) => a.status === "SENT");
  const service = operator.role === "ADMIN" ? "" : SERVICE_LABELS[operator.role];

  return (
    <>
      <PageHeader title={`${service} dashboard`} />
      <Panel title="Incident map">
        <DataState error={incidents.error} loading={incidents.data === undefined} />
        <IncidentMap incidents={open} linkBase="/operator/incidents" />
      </Panel>

      <div className="grid-2">
        <Panel title="Assigned incidents">
          <DataState error={alerts.error} loading={alerts.data === undefined} />
          {acceptError && <div className="notice error">{acceptError}</div>}
          {current && (
            <Link to={`/operator/incidents/${current.incidentId}`} className="current-card">
              <div>
                <div className="muted">Your intervention</div>
                <strong>{current.incidentReference}</strong> · {locationLabel(current)}
              </div>
              <AlertStatusBadge status={current.status} />
            </Link>
          )}
          {alerts.data && waiting.length === 0 && !current && <div className="empty">No incidents for {service} right now.</div>}
          <ul className="list">
            {waiting.map((alert) => (
              <li key={alert.id} className={`new-alert severity-edge-${alert.severity.toLowerCase()}`}>
                <Link to={`/operator/incidents/${alert.incidentId}`}>{alert.incidentReference}</Link>
                <SeverityBadge severity={alert.severity} />
                <span>{alertDescription(alert)}</span>
                <span className="muted">{timeAgo(alert.sentAt)}</span>
                {alert.canAccept && (
                  <AcceptAlertButton alertId={alert.id} incidentId={alert.incidentId} onError={setAcceptError} />
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent alerts">
          <ul className="list">
            {(alerts.data ?? []).slice(0, 6).map((alert) => (
              <li key={alert.id}>
                <Link to={`/operator/incidents/${alert.incidentId}`}>{alert.incidentReference}</Link>
                <AlertStatusBadge status={alert.status} />
                <span className="muted">{alert.assignedOperator ?? "Not accepted yet"}</span>
                <span className="muted">{timeAgo(alert.sentAt)}</span>
              </li>
            ))}
          </ul>
          {alerts.data?.length === 0 && <div className="empty">No alerts yet.</div>}
        </Panel>
      </div>
    </>
  );
}
