import { memo, useMemo } from "react";
import { Link } from "react-router";

import { ALERT_FILTER_LABELS, ALERT_FILTERS, isMyAlert, matchesAlertFilter, sortAlerts, type AlertFilter } from "../../domain/alerts";
import { alertDescription, elapsed, formatTime, locationLabel } from "../../format";
import { useNow } from "../../services/useNow";
import type { Alert, Operator } from "../../types/api";
import { AlertStatusBadge, SeverityBadge } from "../Badges";
import { Icon } from "../Icon";
import { EmptyState, ErrorState, LoadingState, SegmentedControl, StaleNotice } from "../ui";

interface Props {
  alerts: Alert[] | undefined;
  error: string | null;
  onRetry: () => void;
  operator: Pick<Operator, "displayName" | "status">;
  selectedIncidentId: number | null;
  linkFor: (incidentId: number) => string;
  /** Kept in the address bar by the page. */
  filter: AlertFilter;
  onFilter: (filter: AlertFilter) => void;
}

const EMPTY: Record<AlertFilter, { title: string; text: string }> = {
  new: { title: "No new alert", text: "New alerts for your service appear here automatically." },
  mine: { title: "Nothing accepted by you", text: "Alerts you accept are listed here." },
  all: { title: "No alert yet", text: "Alerts for your service appear here as soon as an admin sends them." },
};

/** The service operator's queue: their running intervention, then new alerts, then history. */
export function AlertQueue({ alerts, error, onRetry, operator, selectedIncidentId, linkFor, filter, onFilter }: Props) {
  const now = useNow(15_000);
  const all = useMemo(() => alerts ?? [], [alerts]);
  const shown = useMemo(() => sortAlerts(all.filter((a) => matchesAlertFilter(a, filter, operator))), [all, filter, operator]);
  const segments = ALERT_FILTERS.map((key) => ({ key, label: ALERT_FILTER_LABELS[key], count: all.filter((a) => matchesAlertFilter(a, key, operator)).length }));

  return (
    <section className="queue" aria-labelledby="queue-title">
      <div className="queue-header">
        <div className="queue-title-row">
          <h2 id="queue-title">Alerts for your service</h2>
        </div>
        <SegmentedControl label="Show" segments={segments} value={filter} onChange={onFilter} block />
      </div>
      <div className="queue-body">
        {alerts === undefined ? (
          error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : (
            <LoadingState rows={4} height={96} label="Loading alerts" />
          )
        ) : (
          <>
            {error && <StaleNotice message={error} onRetry={onRetry} />}
            {shown.length === 0 ? (
              <EmptyState compact icon={filter === "new" ? "shieldCheck" : "inbox"} title={EMPTY[filter].title}>
                {EMPTY[filter].text}
              </EmptyState>
            ) : (
              <ol className="queue-list">
                {shown.map((alert) => (
                  <li key={alert.id}>
                    <AlertCard
                      alert={alert}
                      to={linkFor(alert.incidentId)}
                      selected={alert.incidentId === selectedIncidentId}
                      mine={isMyAlert(alert, operator)}
                      now={now}
                    />
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const AlertCard = memo(function AlertCard({ alert, to, selected, mine, now }: { alert: Alert; to: string; selected: boolean; mine: boolean; now: number }) {
  return (
    <Link
      to={to}
      className={`queue-card sev-edge-${alert.severity.toLowerCase()}${selected ? " selected" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="queue-card-top">
        <SeverityBadge severity={alert.severity} />
        {alert.canUpdate && <span className="you-tag">Your intervention</span>}
        <time className="queue-card-time" dateTime={alert.sentAt} title={`Sent at ${formatTime(alert.sentAt)}`}>
          {elapsed(alert.sentAt, now)}
        </time>
      </div>
      <div className="queue-card-title">{alertDescription(alert)}</div>
      <div className="queue-card-location">
        <Icon name="pin" size="sm" />
        <span>{locationLabel(alert)}</span>
      </div>
      <div className="queue-card-bottom">
        <AlertStatusBadge status={alert.status} />
        <span className="queue-card-ref mono">{alert.incidentReference}</span>
      </div>
      {alert.assignedOperator && (
        <div className="queue-card-handler">
          <Icon name="user" size="sm" />
          {mine ? "Accepted by you" : `Accepted by ${alert.assignedOperator}`}
        </div>
      )}
    </Link>
  );
});
