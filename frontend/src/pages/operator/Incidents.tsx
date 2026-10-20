import { Link, useNavigate } from "react-router";

import { AlertStatusBadge, SeverityBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { formatDateTime, locationLabel } from "../../format";
import { api } from "../../services/api";
import { useOperator } from "../../services/auth";
import { usePolling } from "../../services/usePolling";

/** Incidents this operator's service was alerted to. */
export function OperatorIncidents() {
  const operator = useOperator();
  const navigate = useNavigate();
  const incidents = usePolling(() => api.incidents(), []);

  return (
    <>
      <PageHeader title="Incidents" />
      <Panel>
        <DataState
          error={incidents.error}
          loading={incidents.data === undefined}
          empty={incidents.data?.length === 0 ? "Your service has not been alerted to any incident." : undefined}
        />
        {incidents.data && incidents.data.length > 0 && (
          <table className="table clickable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date / Time</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Vehicles</th>
                <th>Our status</th>
                <th>Handled by</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data.map((incident) => {
                const ours = incident.alerts.find((a) => a.serviceType === operator.role);
                return (
                  <tr key={incident.id} onClick={() => void navigate(`/operator/incidents/${incident.id}`)}>
                    <td>
                      <Link to={`/operator/incidents/${incident.id}`}>{incident.reference}</Link>
                    </td>
                    <td>{formatDateTime(incident.detectedAt)}</td>
                    <td>{locationLabel(incident)}</td>
                    <td>
                      <SeverityBadge severity={incident.severity} />
                    </td>
                    <td>{incident.vehicles}</td>
                    <td>{ours && <AlertStatusBadge status={ours.status} />}</td>
                    <td>{ours?.assignedOperator ?? <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
