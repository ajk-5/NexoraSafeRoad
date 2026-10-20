import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { IncidentStatusBadge, SeverityBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { formatDateTime, locationLabel } from "../../format";
import { OPEN_INCIDENT_STATUSES } from "../../labels";
import { api } from "../../services/api";
import { usePolling } from "../../services/usePolling";
import type { Incident } from "../../types/api";

type Filter = "open" | "closed" | "all";
const FILTERS: Record<Filter, { label: string; keep: (incident: Incident) => boolean }> = {
  open: { label: "Open", keep: (i) => OPEN_INCIDENT_STATUSES.includes(i.status) },
  closed: { label: "Closed", keep: (i) => !OPEN_INCIDENT_STATUSES.includes(i.status) },
  all: { label: "All", keep: () => true },
};

export function AdminIncidents() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("open");
  const incidents = usePolling(() => api.incidents(), []);
  const shown = (incidents.data ?? []).filter(FILTERS[filter].keep);

  return (
    <>
      <PageHeader title="Incidents">
        <div className="tabs" role="tablist">
          {(Object.keys(FILTERS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`tab${filter === key ? " active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {FILTERS[key].label}
            </button>
          ))}
        </div>
      </PageHeader>
      <Panel>
        <DataState
          error={incidents.error}
          loading={incidents.data === undefined}
          empty={incidents.data && shown.length === 0 ? "No incidents here." : undefined}
        />
        {shown.length > 0 && (
          <table className="table clickable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date / Time</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assigned operator</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((incident) => (
                <tr key={incident.id} onClick={() => void navigate(`/admin/incidents/${incident.id}`)}>
                  <td>
                    <Link to={`/admin/incidents/${incident.id}`}>{incident.reference}</Link>
                  </td>
                  <td>{formatDateTime(incident.detectedAt)}</td>
                  <td>{locationLabel(incident)}</td>
                  <td>
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td>
                    <IncidentStatusBadge status={incident.status} />
                  </td>
                  <td>
                    {incident.assignedAdmin ?? <span className="muted">—</span>}
                    {incident.canEdit && <span className="you-tag">You</span>}
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
