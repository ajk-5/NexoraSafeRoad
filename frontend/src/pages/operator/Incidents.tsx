import { useMemo, useState } from "react";

import { AlertStatusBadge } from "../../components/Badges";
import { Icon } from "../../components/Icon";
import { IncidentTable } from "../../components/IncidentTable";
import { Card, DataView, EmptyState, PageHeader, SegmentedControl } from "../../components/ui";
import { isOpen, matchesSearch } from "../../domain/incidents";
import { SERVICE_LABELS, serviceOf } from "../../labels";
import { workspacePath } from "../../paths";
import { useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import type { Incident } from "../../types/api";

type Scope = "open" | "all";

/** Incidents this operator's service was alerted to, with where their service stands. */
export function OperatorIncidents() {
  const operator = useOperator();
  const { incidents } = useLive();
  const [scope, setScope] = useState<Scope>("open");
  const [query, setQuery] = useState("");
  const ours = (incident: Incident) => incident.alerts.find((a) => a.serviceType === operator.role);
  const ownService = serviceOf(operator.role);
  const service = ownService ? SERVICE_LABELS[ownService] : "your service";

  const shown = useMemo(
    () => (incidents.data ?? []).filter((i) => (scope === "all" || isOpen(i)) && matchesSearch(i, query)),
    [incidents.data, scope, query],
  );

  return (
    <>
      <PageHeader description={`Every incident ${service} was alerted to, newest first.`} />
      <div className="toolbar">
        <label className="input-with-icon grow">
          <span className="visually-hidden">Search incidents</span>
          <Icon name="search" size="sm" />
          <input className="input" type="search" placeholder="Search by ID, location or camera" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <SegmentedControl
          label="Show"
          segments={[
            { key: "open", label: "Open" },
            { key: "all", label: "All" },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>
      <Card flush>
        <DataView data={incidents.data} error={incidents.error} onRetry={incidents.reload}>
          {(all) =>
            shown.length === 0 ? (
              <EmptyState icon="inbox" title={all.length === 0 ? "No incident yet" : "No incident matches"}>
                {all.length === 0 ? `${service} has not been alerted to any incident.` : "Try another filter or clear the search."}
              </EmptyState>
            ) : (
              <IncidentTable
                incidents={shown}
                columns={["incident", "detected", "location", "severity", "ours"]}
                linkFor={(i) => workspacePath(operator.role, i.id)}
                renderOurs={(i) => {
                  const alert = ours(i);
                  return alert ? (
                    <>
                      <AlertStatusBadge status={alert.status} />
                      <span className="cell-sub">{alert.assignedOperator ?? "Not accepted yet"}</span>
                    </>
                  ) : null;
                }}
                caption={`Incidents ${service} was alerted to`}
              />
            )
          }
        </DataView>
      </Card>
    </>
  );
}
