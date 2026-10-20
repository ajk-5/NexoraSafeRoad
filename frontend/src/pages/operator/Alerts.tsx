import { useState } from "react";
import { Link } from "react-router";

import { AcceptAlertButton } from "../../components/AcceptAlertButton";
import { AlertStatusBadge, SeverityBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { alertDescription, locationLabel, timeAgo } from "../../format";
import { api } from "../../services/api";
import { usePolling } from "../../services/usePolling";

/** This service's alert history, newest first (README "Service Operator Alerts Page"). */
export function OperatorAlerts() {
  const alerts = usePolling(() => api.alerts(), []);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Alerts" />
      {acceptError && <div className="notice error">{acceptError}</div>}
      <Panel>
        <DataState
          error={alerts.error}
          loading={alerts.data === undefined}
          empty={alerts.data?.length === 0 ? "No alerts for your service yet." : undefined}
        />
        {alerts.data && alerts.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Description</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Station</th>
                <th>Status</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((alert) => (
                <tr key={alert.id} className={alert.status === "SENT" ? "highlight" : undefined}>
                  <td>
                    <Link to={`/operator/incidents/${alert.incidentId}`}>{alert.incidentReference}</Link>
                  </td>
                  <td>{alertDescription(alert)}</td>
                  <td>
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td>{locationLabel(alert)}</td>
                  <td>{alert.station?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <AlertStatusBadge status={alert.status} />
                  </td>
                  <td>{timeAgo(alert.sentAt)}</td>
                  <td>
                    {alert.canAccept && (
                      <AcceptAlertButton alertId={alert.id} incidentId={alert.incidentId} onError={setAcceptError} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
