import { useMemo } from "react";

import { buildTimeline } from "../../domain/timeline";
import { formatFullDateTime, formatTime } from "../../format";
import type { Incident } from "../../types/api";
import { Card } from "../ui";

/** What happened, in order, with who did it. The last line is what is happening now. */
export function IncidentTimeline({ incident }: { incident: Incident }) {
  const events = useMemo(() => buildTimeline(incident), [incident]);
  return (
    <Card title="Activity" icon="activity" className="timeline-card">
      <ol className="timeline">
        {events.map((event) => (
          <li key={event.key} className={`timeline-item tl-${event.tone}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-content">
              <div className="timeline-title">{event.title}</div>
              {event.detail && <div className="timeline-detail">{event.detail}</div>}
            </div>
            {event.at ? (
              <time className="timeline-time" dateTime={event.at} title={formatFullDateTime(event.at)}>
                {formatTime(event.at)}
              </time>
            ) : (
              <span className="timeline-time now">Now</span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
