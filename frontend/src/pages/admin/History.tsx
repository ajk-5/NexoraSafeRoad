import { useMemo, useState } from "react";

import { Icon } from "../../components/Icon";
import { IncidentTable } from "../../components/IncidentTable";
import { Card, DataView, EmptyState, PageHeader, SegmentedControl } from "../../components/ui";
import { isOpen, matchesSearch } from "../../domain/incidents";
import { localDay } from "../../format";
import { SEVERITIES, SEVERITY_LABELS } from "../../labels";
import { workspacePath } from "../../paths";
import { useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import type { Incident, Severity } from "../../types/api";

type Outcome = "all" | "resolved" | "rejected";

const OUTCOMES: Record<Outcome, { label: string; keep: (i: Incident) => boolean }> = {
  all: { label: "All outcomes", keep: () => true },
  resolved: { label: "Resolved", keep: (i) => i.status === "RESOLVED" },
  rejected: { label: "Rejected / False alarm", keep: (i) => i.status === "DECLINED" },
};

/** Completed incidents and how they ended, kept apart from live operations. */
export function AdminHistory() {
  const operator = useOperator();
  const { incidents } = useLive();
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  const closed = useMemo(() => (incidents.data ?? []).filter((i) => !isOpen(i)), [incidents.data]);
  const shown = useMemo(
    () =>
      closed
        .filter((i) => {
          const day = localDay(i.detectedAt);
          return (
            OUTCOMES[outcome].keep(i) &&
            (severity === "" || i.severity === severity) &&
            (from === "" || day >= from) &&
            (to === "" || day <= to) &&
            matchesSearch(i, query)
          );
        })
        .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt)),
    [closed, outcome, severity, from, to, query],
  );
  const filtered = outcome !== "all" || severity !== "" || from !== "" || to !== "" || query !== "";

  return (
    <>
      <PageHeader description="Resolved incidents and false alarms, with who decided and how long it took." />
      <div className="toolbar">
        <label className="input-with-icon grow">
          <span className="visually-hidden">Search history</span>
          <Icon name="search" size="sm" />
          <input className="input" type="search" placeholder="Search by ID, location, camera or operator" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <SegmentedControl
          label="Outcome"
          segments={(Object.keys(OUTCOMES) as Outcome[]).map((key) => ({ key, label: OUTCOMES[key].label }))}
          value={outcome}
          onChange={setOutcome}
        />
        <select className="select inline-select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")} aria-label="Severity">
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]} severity
            </option>
          ))}
        </select>
        <label className="date-field">
          <span>From</span>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="date-field">
          <span>To</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {filtered && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setOutcome("all");
              setSeverity("");
              setFrom("");
              setTo("");
              setQuery("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      <Card flush>
        <DataView data={incidents.data} error={incidents.error} onRetry={incidents.reload}>
          {(all) =>
            shown.length === 0 ? (
              <EmptyState icon="list" title={closed.length === 0 ? "No completed incident yet" : "No incident matches"}>
                {closed.length === 0 ? "Incidents appear here once they are resolved or rejected." : "Try other filters."}
              </EmptyState>
            ) : (
              <>
                <IncidentTable
                  incidents={shown}
                  columns={["incident", "detected", "location", "severity", "status", "handler", "decisionTime", "closed"]}
                  linkFor={(i) => workspacePath(operator.role, i.id)}
                  caption="Completed incidents"
                />
                {all.length >= 100 && <p className="table-note">Based on the 100 most recent incidents (the server's limit).</p>}
              </>
            )
          }
        </DataView>
      </Card>
    </>
  );
}
