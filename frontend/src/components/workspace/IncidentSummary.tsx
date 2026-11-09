import { incidentTitle } from "../../domain/incidents";
import { elapsed, formatFullDateTime, formatTime, locationLabel } from "../../format";
import { useNow } from "../../services/useNow";
import type { Incident } from "../../types/api";
import { IncidentStatusBadge, SeverityBadge } from "../Badges";

interface Props {
  incident: Incident;
  /** Who is responsible, as shown to this viewer, e.g. "You" or "Admin 2". */
  handledBy: string | null;
  headingId: string;
}

/** The first thing read in the workspace: what, how serious, where, when, and who has it. */
export function IncidentSummary({ incident, handledBy, headingId }: Props) {
  const now = useNow(15_000);
  return (
    <header className="ws-summary">
      <div className="ws-badges">
        <SeverityBadge severity={incident.severity} large />
        <IncidentStatusBadge status={incident.status} large />
      </div>
      <h2 className="ws-title" id={headingId}>
        {incidentTitle(incident)}
      </h2>
      <dl className="ws-meta">
        <div>
          <dt>Incident</dt>
          <dd className="mono">{incident.reference}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{locationLabel(incident)}</dd>
        </div>
        <div>
          <dt>Detected</dt>
          <dd>
            <time dateTime={incident.detectedAt} title={formatFullDateTime(incident.detectedAt)}>
              {formatTime(incident.detectedAt)}
            </time>
            <span className="muted"> · {elapsed(incident.detectedAt, now)} ago</span>
          </dd>
        </div>
        <div>
          <dt>Handled by</dt>
          <dd>{handledBy ?? <span className="muted">Nobody yet</span>}</dd>
        </div>
      </dl>
    </header>
  );
}
