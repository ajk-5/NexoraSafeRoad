import { Link } from "react-router";

import { AlertStatusBadge, SeverityBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { formatDateTime, locationLabel } from "../../format";
import { SERVICE_LABELS } from "../../labels";
import { api } from "../../services/api";
import { usePolling } from "../../services/usePolling";

/** Every alert sent to a service, newest first (README "Admin Alerts Page"). */
export function AdminAlerts() {
  const alerts = usePolling(() => api.alerts(), []);

  return (
    <>
      <PageHeader title="Alerts" />
      <Panel>
        <DataState
          error={alerts.error}
          loading={alerts.data === undefined}
          empty={alerts.data?.length === 0 ? "No alerts sent yet." : undefined}
        />
        {alerts.data && alerts.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Service</th>
                <th>Station</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Handled by</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((alert) => (
                <tr key={alert.id}>
                  <td>
                    <Link to={`/admin/incidents/${alert.incidentId}`}>{alert.incidentReference}</Link>
                  </td>
                  <td>{SERVICE_LABELS[alert.serviceType]}</td>
                  <td>{alert.station?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <AlertStatusBadge status={alert.status} />
                  </td>
                  <td>
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td>{locationLabel(alert)}</td>
                  <td>{alert.assignedOperator ?? <span className="muted">—</span>}</td>
                  <td>{formatDateTime(alert.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
