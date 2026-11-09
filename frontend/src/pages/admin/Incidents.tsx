import { useMemo, useState } from "react";
import { Link } from "react-router";

import { AlertStatusBadge, SeverityBadge } from "../../components/Badges";
import { Icon } from "../../components/Icon";
import { IncidentTable } from "../../components/IncidentTable";
import { Card, DataView, EmptyState, PageHeader, Pagination, SegmentedControl, Tabs } from "../../components/ui";
import { isOpen, isUndecided, matchesSearch } from "../../domain/incidents";
import { formatDateTime, locationLabel } from "../../format";
import { SERVICE_LABELS, SEVERITIES, SEVERITY_LABELS } from "../../labels";
import { workspacePath } from "../../paths";
import { api } from "../../services/api";
import { useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import { usePolling } from "../../services/usePolling";
import type { Incident, Severity } from "../../types/api";

type Scope = "open" | "undecided" | "services" | "closed" | "all";

const SCOPES: Record<Scope, { label: string; keep: (i: Incident) => boolean }> = {
  open: { label: "Open", keep: isOpen },
  undecided: { label: "To decide", keep: isUndecided },
  services: { label: "With services", keep: (i) => i.status === "ALERT_SENT" || i.status === "IN_PROGRESS" },
  closed: { label: "Closed", keep: (i) => !isOpen(i) },
  all: { label: "All", keep: () => true },
};

type Tab = "incidents" | "dispatches";

/** Every incident, searchable and filterable, and the log of alerts sent to services. */
export function AdminIncidents() {
  const [tab, setTab] = useState<Tab>("incidents");
  return (
    <Tabs
      idBase="incidents"
      label="Incidents"
      value={tab}
      onChange={setTab}
      tabs={[
        { key: "incidents", label: "Incidents", icon: "list" },
        { key: "dispatches", label: "Alerts sent", icon: "send" },
      ]}
    >
      {tab === "incidents" ? <IncidentsTab /> : <DispatchesTab />}
    </Tabs>
  );
}

function IncidentsTab() {
  const operator = useOperator();
  const { incidents } = useLive();
  const [scope, setScope] = useState<Scope>("open");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [query, setQuery] = useState("");

  const shown = useMemo(
    () => (incidents.data ?? []).filter((i) => SCOPES[scope].keep(i) && (severity === "" || i.severity === severity) && matchesSearch(i, query)),
    [incidents.data, scope, severity, query],
  );
  const count = (key: Scope) => (incidents.data ?? []).filter(SCOPES[key].keep).length;

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="input-with-icon grow">
          <span className="visually-hidden">Search incidents</span>
          <Icon name="search" size="sm" />
          <input className="input" type="search" placeholder="Search by ID, location, camera or operator" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <SegmentedControl
          label="Status"
          segments={(Object.keys(SCOPES) as Scope[]).map((key) => ({ key, label: SCOPES[key].label, count: count(key) }))}
          value={scope}
          onChange={setScope}
        />
        <label className="field inline-field">
          <span className="visually-hidden">Severity</span>
          <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]} severity
              </option>
            ))}
          </select>
        </label>
      </div>
      <Card flush>
        <DataView data={incidents.data} error={incidents.error} onRetry={incidents.reload}>
          {(all) =>
            shown.length === 0 ? (
              <EmptyState icon="search" title="No incident matches">
                Try another status or clear the search.
              </EmptyState>
            ) : (
              <>
                <IncidentTable
                  incidents={shown}
                  columns={["incident", "detected", "location", "severity", "status", "handler"]}
                  linkFor={(i) => workspacePath(operator.role, i.id)}
                  caption="Incidents"
                />
                {all.length >= 100 && <p className="table-note">Showing the 100 most recent incidents (the server's limit).</p>}
              </>
            )
          }
        </DataView>
      </Card>
    </div>
  );
}

const PAGE = 20;

function DispatchesTab() {
  const operator = useOperator();
  const alerts = usePolling(() => api.alerts(), []);
  const [page, setPage] = useState(0);
  return (
    <div className="stack">
      <PageHeader description="Every alert sent to a service, newest first, with where each intervention stands." />
      <Card flush>
        <DataView data={alerts.data} error={alerts.error} onRetry={alerts.reload}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState icon="send" title="No alert sent yet">
                Alerts appear here once an admin sends one.
              </EmptyState>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Alerts sent</caption>
                    <thead>
                      <tr>
                        <th scope="col">Incident</th>
                        <th scope="col">Service</th>
                        <th scope="col">Station</th>
                        <th scope="col">Status</th>
                        <th scope="col">Severity</th>
                        <th scope="col">Location</th>
                        <th scope="col">Accepted by</th>
                        <th scope="col">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.slice(page * PAGE, page * PAGE + PAGE).map((alert) => (
                        <tr key={alert.id}>
                          <td>
                            <Link to={workspacePath(operator.role, alert.incidentId)} className="row-link mono">
                              {alert.incidentReference}
                            </Link>
                          </td>
                          <td>{SERVICE_LABELS[alert.serviceType]}</td>
                          <td>{alert.station?.name ?? <span className="subtle">—</span>}</td>
                          <td>
                            <AlertStatusBadge status={alert.status} />
                          </td>
                          <td>
                            <SeverityBadge severity={alert.severity} />
                          </td>
                          <td>{locationLabel(alert)}</td>
                          <td>{alert.assignedOperator ?? <span className="subtle">Not accepted yet</span>}</td>
                          <td className="nowrap">{formatDateTime(alert.sentAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageCount={Math.ceil(list.length / PAGE)} total={list.length} pageSize={PAGE} onPage={setPage} />
              </>
            )
          }
        </DataView>
      </Card>
    </div>
  );
}
