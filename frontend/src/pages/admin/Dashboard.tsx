import { Link } from "react-router";

import { AlertStatusBadge, OperatorStatusBadge } from "../../components/Badges";
import { IncidentMap } from "../../components/IncidentMap";
import { DataState, PageHeader, Panel, StatTile } from "../../components/ui";
import { formatDuration, timeAgo } from "../../format";
import { OPEN_INCIDENT_STATUSES, ROLE_LABELS, SERVICE_LABELS } from "../../labels";
import { api } from "../../services/api";
import { usePolling } from "../../services/usePolling";

export function AdminDashboard() {
  const incidents = usePolling(() => api.incidents(), []);
  const alerts = usePolling(() => api.alerts(), []);
  const statistics = usePolling(() => api.statistics(), []);
  const operators = usePolling(() => api.operators(), []);

  const open = (incidents.data ?? []).filter((i) => OPEN_INCIDENT_STATUSES.includes(i.status));
  const waiting = open.filter((i) => i.status === "WAITING_FOR_OPERATOR").length;
  const admins = (operators.data ?? []).filter((o) => o.role === "ADMIN");
  const availableAdmins = admins.filter((o) => o.status === "ACTIVE").length;
  const responseSeconds = statistics.data?.averageResponseSeconds ?? null;

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="tiles">
        <StatTile label="Open incidents" value={open.length} tone={open.some((i) => i.severity === "HIGH") ? "danger" : undefined} />
        <StatTile label="Waiting for an admin" value={waiting} tone={waiting > 0 ? "warning" : undefined} />
        <StatTile label="Average response time" value={responseSeconds === null ? "—" : formatDuration(responseSeconds)} />
        <StatTile label="Admins available" value={`${availableAdmins} / ${admins.length}`} />
      </div>

      <Panel title="Live incident map">
        <DataState error={incidents.error} loading={incidents.data === undefined} />
        <IncidentMap incidents={open} linkBase="/admin/incidents" />
      </Panel>

      <div className="grid-2">
        <Panel title="Recent alerts">
          <DataState
            error={alerts.error}
            loading={alerts.data === undefined}
            empty={alerts.data?.length === 0 ? "No alerts sent yet." : undefined}
          />
          <ul className="list">
            {(alerts.data ?? []).slice(0, 6).map((alert) => (
              <li key={alert.id}>
                <Link to={`/admin/incidents/${alert.incidentId}`}>{alert.incidentReference}</Link>
                <span>{SERVICE_LABELS[alert.serviceType]}</span>
                <AlertStatusBadge status={alert.status} />
                <span className="muted">{timeAgo(alert.sentAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Operators">
          <DataState error={operators.error} loading={operators.data === undefined} />
          <ul className="list">
            {(operators.data ?? []).map((operator) => (
              <li key={operator.id}>
                <span>{operator.displayName}</span>
                <span className="muted">{ROLE_LABELS[operator.role]}</span>
                <OperatorStatusBadge status={operator.status} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
