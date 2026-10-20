import { formatDateTime, locationLabel, percent } from "../format";
import type { Incident } from "../types/api";
import { IncidentStatusBadge, SeverityBadge } from "./Badges";

/** What the operator needs to know at a glance (README "Incident Information"). */
export function IncidentFacts({ incident }: { incident: Incident }) {
  return (
    <dl className="facts">
      <dt>Incident</dt>
      <dd>{incident.reference}</dd>
      <dt>Location</dt>
      <dd>{locationLabel(incident)}</dd>
      <dt>Time</dt>
      <dd>{formatDateTime(incident.detectedAt)}</dd>
      <dt>Severity</dt>
      <dd>
        <SeverityBadge severity={incident.severity} />
      </dd>
      <dt>Status</dt>
      <dd>
        <IncidentStatusBadge status={incident.status} />
      </dd>
      <dt>Vehicles</dt>
      <dd>{incident.vehicles}</dd>
      <dt>Possible injuries</dt>
      <dd className={incident.possibleInjuries ? "emphasis" : undefined}>{incident.possibleInjuries ? "Yes" : "No"}</dd>
      <dt>AI confidence</dt>
      <dd>{percent(incident.confidence)}</dd>
    </dl>
  );
}
