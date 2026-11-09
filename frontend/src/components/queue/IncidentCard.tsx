import { memo } from "react";
import { Link } from "react-router";

import { incidentTitle } from "../../domain/incidents";
import { elapsed, formatTime, locationLabel } from "../../format";
import type { Incident } from "../../types/api";
import { IncidentStatusBadge, SeverityBadge } from "../Badges";
import { Icon } from "../Icon";

interface Props {
  incident: Incident;
  to: string;
  selected: boolean;
  /** Arrived since the queue was first shown and not opened yet. */
  isNew: boolean;
  now: number;
}

/** One incident in the queue: everything needed to decide whether to open it. */
export const IncidentCard = memo(function IncidentCard({ incident, to, selected, isNew, now }: Props) {
  const handler = incident.assignedAdmin;
  return (
    <Link
      to={to}
      className={`queue-card sev-edge-${incident.severity.toLowerCase()}${selected ? " selected" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="queue-card-top">
        <SeverityBadge severity={incident.severity} />
        {isNew && <span className="new-tag">New</span>}
        {incident.canEdit && <span className="you-tag">Assigned to you</span>}
        <time className="queue-card-time" dateTime={incident.detectedAt} title={`Detected at ${formatTime(incident.detectedAt)}`}>
          {elapsed(incident.detectedAt, now)}
        </time>
      </div>
      <div className="queue-card-title">{incidentTitle(incident)}</div>
      <div className="queue-card-location">
        <Icon name="pin" size="sm" />
        <span>{locationLabel(incident)}</span>
      </div>
      <div className="queue-card-bottom">
        <IncidentStatusBadge status={incident.status} />
        <span className="queue-card-ref mono">{incident.reference}</span>
      </div>
      {handler && !incident.canEdit && incident.status !== "WAITING_FOR_OPERATOR" && (
        <div className="queue-card-handler">
          <Icon name="user" size="sm" />
          Handled by {handler}
        </div>
      )}
    </Link>
  );
});
