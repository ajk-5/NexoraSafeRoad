import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { incidentTitle } from "../domain/incidents";
import { formatDateTime, formatDuration, locationLabel } from "../format";
import type { Incident } from "../types/api";
import { IncidentStatusBadge, SeverityBadge } from "./Badges";
import { Pagination } from "./ui";

export type Column = "incident" | "detected" | "location" | "severity" | "status" | "handler" | "decisionTime" | "closed" | "ours";

const HEADERS: Record<Column, string> = {
  incident: "Incident",
  detected: "Detected",
  location: "Location",
  severity: "Severity",
  status: "Status",
  handler: "Handled by",
  decisionTime: "Time to decision",
  closed: "Closed",
  ours: "Your service",
};

interface Props {
  incidents: Incident[];
  columns: Column[];
  /** Where a row opens. */
  linkFor: (incident: Incident) => string;
  /** Extra cell content for the "ours" column (service operators). */
  renderOurs?: (incident: Incident) => ReactNode;
  pageSize?: number;
  caption: string;
}

/** A readable incident table, a page at a time. Each row opens the incident in the workspace. */
export function IncidentTable({ incidents, columns, linkFor, renderOurs, pageSize = 20, caption }: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(incidents.length / pageSize));
  // Filters can shrink the list below the current page.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);
  const rows = incidents.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <>
      <div className="table-wrap">
        <table className="table interactive">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {HEADERS[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((incident) => (
              <tr key={incident.id} onClick={() => void navigate(linkFor(incident))}>
                {columns.map((column) => (
                  <td key={column}>{cell(column, incident, linkFor, renderOurs)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={incidents.length} pageSize={pageSize} onPage={setPage} />
    </>
  );
}

function cell(column: Column, incident: Incident, linkFor: (incident: Incident) => string, renderOurs?: (incident: Incident) => ReactNode): ReactNode {
  switch (column) {
    case "incident":
      return (
        <>
          <Link to={linkFor(incident)} className="row-link mono" onClick={(event) => event.stopPropagation()}>
            {incident.reference}
          </Link>
          <span className="cell-sub">{incidentTitle(incident)}</span>
        </>
      );
    case "detected":
      return <span className="nowrap">{formatDateTime(incident.detectedAt)}</span>;
    case "location":
      return locationLabel(incident);
    case "severity":
      return <SeverityBadge severity={incident.severity} />;
    case "status":
      return <IncidentStatusBadge status={incident.status} />;
    case "handler":
      return (
        <>
          {incident.assignedAdmin ?? <span className="subtle">—</span>}
          {incident.canEdit && <span className="you-tag"> You</span>}
        </>
      );
    case "decisionTime":
      return incident.decidedAt ? formatDuration((Date.parse(incident.decidedAt) - Date.parse(incident.detectedAt)) / 1000, true) : <span className="subtle">—</span>;
    case "closed": {
      const closedAt = incident.status === "RESOLVED" ? incident.resolvedAt : incident.decidedAt;
      return closedAt ? <span className="nowrap">{formatDateTime(closedAt)}</span> : <span className="subtle">—</span>;
    }
    case "ours":
      return renderOurs?.(incident) ?? null;
  }
}
