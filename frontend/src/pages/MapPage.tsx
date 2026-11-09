import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { IncidentStatusBadge, SeverityBadge } from "../components/Badges";
import { Icon } from "../components/Icon";
import { IncidentsMap } from "../components/maps/IncidentsMap";
import { EmptyState, ErrorState, LoadingState, SegmentedControl, StaleNotice } from "../components/ui";
import { incidentTitle, isOpen, isUndecided, SEVERITY_RANK } from "../domain/incidents";
import { elapsed, locationLabel } from "../format";
import { SEVERITIES, SEVERITY_LABELS, SEVERITY_LETTERS } from "../labels";
import { parseId, workspacePath } from "../paths";
import { useOperator } from "../services/auth";
import { useLive } from "../services/live";
import { useNow } from "../services/useNow";
import type { Incident, Severity } from "../types/api";

type Scope = "open" | "undecided" | "all";

const SCOPES: Record<Scope, { label: string; keep: (i: Incident) => boolean }> = {
  open: { label: "Open", keep: isOpen },
  undecided: { label: "To decide", keep: isUndecided },
  all: { label: "All", keep: () => true },
};

/** All incidents on one map, with a synchronized list that also works without the map. */
export function MapPage() {
  const operator = useOperator();
  const { incidents } = useLive();
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<Scope>("open");
  const [severities, setSeverities] = useState<Severity[]>([...SEVERITIES]);
  const now = useNow(30_000);
  const selectedId = parseId(params.get("incident"));
  const isAdmin = operator.role === "ADMIN";

  const shown = useMemo(
    () =>
      (incidents.data ?? [])
        .filter((i) => SCOPES[scope].keep(i) && severities.includes(i.severity))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || Date.parse(b.detectedAt) - Date.parse(a.detectedAt)),
    [incidents.data, scope, severities],
  );
  // The selected incident stays visible even when a filter would hide it.
  const selected = (incidents.data ?? []).find((i) => i.id === selectedId);
  const onMap = selected && !shown.includes(selected) ? [...shown, selected] : shown;

  const select = (id: number) => setParams({ incident: String(id) }, { replace: true });
  const toggleSeverity = (severity: Severity) =>
    setSeverities((current) => (current.includes(severity) ? current.filter((s) => s !== severity) : [...current, severity]));

  return (
    <div className="page-bleed map-page">
      <aside className="map-side" aria-label="Incidents on the map">
        <div className="map-filters">
          <SegmentedControl
            label="Incidents"
            segments={(Object.keys(SCOPES) as Scope[])
              .filter((key) => isAdmin || key !== "undecided")
              .map((key) => ({ key, label: SCOPES[key].label }))}
            value={scope}
            onChange={setScope}
            block
          />
          <div className="severity-toggles" role="group" aria-label="Severity">
            {SEVERITIES.map((severity) => (
              <button
                key={severity}
                type="button"
                className={`severity-toggle sev-${severity.toLowerCase()}`}
                aria-pressed={severities.includes(severity)}
                onClick={() => toggleSeverity(severity)}
              >
                <span className={`sev-pin sev-pin-${severity.toLowerCase()} mini`} aria-hidden="true">
                  {SEVERITY_LETTERS[severity]}
                </span>
                {SEVERITY_LABELS[severity]}
              </button>
            ))}
          </div>
        </div>
        <div className="map-list-wrap">
          {incidents.data === undefined ? (
            incidents.error ? (
              <ErrorState message={incidents.error} onRetry={incidents.reload} />
            ) : (
              <LoadingState rows={5} height={64} label="Loading incidents" />
            )
          ) : (
            <>
              {incidents.error && <StaleNotice message={incidents.error} onRetry={incidents.reload} />}
              {shown.length === 0 ? (
                <EmptyState compact icon="map" title="No incident to show">
                  Nothing matches these filters.
                </EmptyState>
              ) : (
                <MapList incidents={shown} selectedId={selectedId} onSelect={select} now={now} />
              )}
            </>
          )}
        </div>
      </aside>

      <div className="map-main">
        <IncidentsMap incidents={onMap} selectedId={selectedId} onSelect={select} />
        <div className="map-legend" aria-hidden="true">
          {SEVERITIES.map((severity) => (
            <span key={severity}>
              <span className={`sev-pin sev-pin-${severity.toLowerCase()} mini`}>{SEVERITY_LETTERS[severity]}</span>
              {SEVERITY_LABELS[severity]}
            </span>
          ))}
        </div>
        {selected && (
          <section className="map-detail card" aria-label={`Selected incident ${selected.reference}`}>
            <div className="map-detail-head">
              <SeverityBadge severity={selected.severity} />
              <IncidentStatusBadge status={selected.status} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Close" onClick={() => setParams({}, { replace: true })}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="strong">{incidentTitle(selected)}</div>
            <div className="small muted">
              <span className="mono">{selected.reference}</span> · {locationLabel(selected)} · {elapsed(selected.detectedAt, now)} ago
            </div>
            <Link to={workspacePath(operator.role, selected.id)} className="btn btn-primary btn-sm">
              Open in workspace
              <Icon name="chevronRight" size="sm" />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

function MapList({ incidents, selectedId, onSelect, now }: { incidents: Incident[]; selectedId: number | null; onSelect: (id: number) => void; now: number }) {
  const listRef = useRef<HTMLOListElement>(null);
  // A marker click selects in the list too: bring that row into view.
  useEffect(() => {
    if (selectedId === null) return;
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <ol className="map-list" ref={listRef} aria-label={`${incidents.length} incidents`}>
      {incidents.map((incident) => (
        <li key={incident.id}>
          <button
            type="button"
            data-id={incident.id}
            className={`map-list-item sev-edge-${incident.severity.toLowerCase()}${incident.id === selectedId ? " selected" : ""}`}
            aria-pressed={incident.id === selectedId}
            onClick={() => onSelect(incident.id)}
          >
            <span className="map-list-top">
              <SeverityBadge severity={incident.severity} />
              <span className="mono small muted">{incident.reference}</span>
              <span className="small muted map-list-time">{elapsed(incident.detectedAt, now)}</span>
            </span>
            <span className="map-list-title">{locationLabel(incident)}</span>
            <IncidentStatusBadge status={incident.status} />
          </button>
        </li>
      ))}
    </ol>
  );
}
