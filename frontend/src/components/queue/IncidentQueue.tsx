import { useEffect, useMemo, useRef, useState } from "react";

import {
  isOpen,
  matchesQueueFilter,
  matchesSearch,
  QUEUE_FILTER_LABELS,
  sortQueue,
  type QueueFilter,
  type QueueOrder,
} from "../../domain/incidents";
import { locationLabel } from "../../format";
import { useNow } from "../../services/useNow";
import type { Incident, Operator } from "../../types/api";
import { Icon } from "../Icon";
import { EmptyState, ErrorState, LoadingState, SegmentedControl, StaleNotice } from "../ui";
import { IncidentCard } from "./IncidentCard";

const FILTERS: QueueFilter[] = ["all", "waiting", "mine", "high"];

interface Props {
  /** Every incident the operator can see; the queue keeps the open ones. */
  incidents: Incident[] | undefined;
  error: string | null;
  onRetry: () => void;
  operator: Pick<Operator, "displayName" | "status">;
  selectedId: number | null;
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  linkFor: (incidentId: number) => string;
}

/** The left column of the dashboard: open incidents, most urgent first. */
export function IncidentQueue({ incidents, error, onRetry, operator, selectedId, filter, onFilter, linkFor }: Props) {
  const [order, setOrder] = useState<QueueOrder>("priority");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const now = useNow(15_000);

  const open = useMemo(() => (incidents ?? []).filter(isOpen), [incidents]);
  const shown = useMemo(
    () => sortQueue(open.filter((i) => matchesQueueFilter(i, filter, operator) && matchesSearch(i, query)), order),
    [open, filter, operator, query, order],
  );
  const { fresh, announcement } = useNewIncidents(open, selectedId);

  const segments = FILTERS.map((key) => ({
    key,
    label: QUEUE_FILTER_LABELS[key],
    count: open.filter((i) => matchesQueueFilter(i, key, operator)).length,
  }));

  return (
    <section className="queue" aria-labelledby="queue-title">
      <div className="queue-header">
        <div className="queue-title-row">
          <h2 id="queue-title">Incident queue</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={searching ? "Close search" : "Search incidents"}
            aria-expanded={searching}
            onClick={() => {
              setSearching((value) => !value);
              setQuery("");
            }}
          >
            <Icon name={searching ? "x" : "search"} size="sm" />
          </button>
        </div>
        {searching && (
          <label className="input-with-icon">
            <span className="visually-hidden">Search by ID, location, camera or operator</span>
            <Icon name="search" size="sm" />
            <input
              className="input input-sm"
              type="search"
              placeholder="ID, location, camera…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </label>
        )}
        <SegmentedControl label="Show" segments={segments} value={filter} onChange={onFilter} block />
        <div className="queue-order">
          <span className="small muted">Order</span>
          <SegmentedControl
            label="Order"
            segments={[
              { key: "priority", label: "Priority" },
              { key: "newest", label: "Newest" },
            ]}
            value={order}
            onChange={setOrder}
          />
        </div>
      </div>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      <div className="queue-body">
        {incidents === undefined ? (
          error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : (
            <LoadingState rows={4} height={104} label="Loading incidents" />
          )
        ) : (
          <>
            {error && <StaleNotice message={error} onRetry={onRetry} />}
            {shown.length === 0 ? (
              <QueueEmpty filter={filter} query={query} paused={operator.status === "PAUSED"} />
            ) : (
              <ol className="queue-list" aria-label={`${shown.length} incidents, ${order === "priority" ? "most urgent first" : "newest first"}`}>
                {shown.map((incident) => (
                  <li key={incident.id}>
                    <IncidentCard
                      incident={incident}
                      to={linkFor(incident.id)}
                      selected={incident.id === selectedId}
                      isNew={fresh.has(incident.id)}
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

function QueueEmpty({ filter, query, paused }: { filter: QueueFilter; query: string; paused: boolean }) {
  if (query.trim()) return <EmptyState compact icon="search" title="No match" >Nothing in the queue matches “{query.trim()}”.</EmptyState>;
  if (filter === "mine") {
    return (
      <EmptyState compact icon="user" title="Nothing assigned to you">
        {paused ? "You are paused, so no incident is assigned to you." : "New incidents are assigned to you automatically."}
      </EmptyState>
    );
  }
  if (filter === "all") {
    return (
      <EmptyState compact icon="shieldCheck" title="All clear">
        No open incident right now. New detections appear here automatically.
      </EmptyState>
    );
  }
  return <EmptyState compact icon="inbox" title="Nothing here">No open incident matches this filter.</EmptyState>;
}

/**
 * Incidents that arrived after the queue was first shown and have not been opened, plus a
 * screen-reader announcement for new high-severity ones. Nothing flashes or moves.
 */
function useNewIncidents(open: Incident[], selectedId: number | null) {
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (open.length === 0 && seen.current === null) return;
    if (seen.current === null) {
      seen.current = new Set(open.map((i) => i.id)); // what was there on arrival is not "new"
      return;
    }
    const arrived = open.filter((i) => !seen.current?.has(i.id));
    if (arrived.length === 0) return;
    arrived.forEach((i) => seen.current?.add(i.id));
    setFresh((previous) => new Set([...previous, ...arrived.map((i) => i.id)]));
    const high = arrived.filter((i) => i.severity === "HIGH");
    if (high[0]) setAnnouncement(`New high-severity incident ${high[0].reference} at ${locationLabel(high[0])}.`);
  }, [open]);

  useEffect(() => {
    if (selectedId === null) return;
    setFresh((previous) => {
      if (!previous.has(selectedId)) return previous;
      const next = new Set(previous);
      next.delete(selectedId);
      return next;
    });
  }, [selectedId]);

  return { fresh, announcement };
}
