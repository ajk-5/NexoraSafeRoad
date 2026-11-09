import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { Icon } from "../../components/Icon";
import { IncidentQueue } from "../../components/queue/IncidentQueue";
import { IncidentWorkspace } from "../../components/workspace/IncidentWorkspace";
import type { QueueFilter } from "../../domain/incidents";
import { parseId } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { useAuth, useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import type { Operator } from "../../types/api";

const FILTERS: QueueFilter[] = ["all", "waiting", "mine", "high"];

/**
 * The operator's workspace: what is waiting, and the selected incident with everything needed to
 * decide on it. With no incident chosen, the one assigned to the operator opens by itself.
 */
export function AdminDashboard() {
  const operator = useOperator();
  const { incidents } = useLive();
  const [params, setParams] = useSearchParams();

  const explicitId = parseId(params.get("incident"));
  const selectedId = explicitId ?? operator.currentIncidentId;
  const workspaceRef = useRef<HTMLDivElement>(null);
  // A newly chosen incident starts at its top, not where the previous one was scrolled to.
  useEffect(() => {
    workspaceRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 }); // phones scroll the page itself
  }, [selectedId]);
  const filterParam = params.get("filter") as QueueFilter | null;
  const filter = filterParam && FILTERS.includes(filterParam) ? filterParam : "all";
  const waiting = (incidents.data ?? []).filter((i) => i.status === "WAITING_FOR_OPERATOR" || i.status === "DETECTED").length;

  const setFilter = (next: QueueFilter) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "all") updated.delete("filter");
        else updated.set("filter", next);
        return updated;
      },
      { replace: true },
    );

  const linkFor = (id: number) => {
    const target = new URLSearchParams(params);
    target.set("incident", String(id));
    return `?${target.toString()}`;
  };

  return (
    <div className={`page-bleed dashboard${explicitId !== null ? " has-selection" : ""}`}>
      <div className="dashboard-body">
        <IncidentQueue
          incidents={incidents.data}
          error={incidents.error}
          onRetry={incidents.reload}
          operator={operator}
          selectedId={selectedId}
          filter={filter}
          onFilter={setFilter}
          linkFor={linkFor}
        />
        <div className="workspace-area" ref={workspaceRef}>
          {selectedId === null ? <IdleWorkspace operator={operator} waiting={waiting} /> : <IncidentWorkspace key={selectedId} id={selectedId} />}
        </div>
      </div>
    </div>
  );
}

/** Nothing selected and nothing assigned: say what happens next instead of an empty panel. */
function IdleWorkspace({ operator, waiting }: { operator: Operator; waiting: number }) {
  const { update } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = operator.status === "PAUSED";

  const resume = async () => {
    setBusy(true);
    setError(null);
    try {
      update(await api.resume());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="idle-workspace card">
      <div className={`idle-icon${paused ? " paused" : ""}`}>
        <Icon name={paused ? "pause" : "shieldCheck"} size="lg" />
      </div>
      {paused ? (
        <>
          <h2>You are paused</h2>
          <p>
            You receive no new incidents while paused.
            {waiting > 0 && ` ${waiting} incident${waiting === 1 ? " is" : "s are"} waiting for an operator.`}
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void resume()} disabled={busy}>
            <Icon name="play" />
            {busy ? "Resuming…" : "Resume and receive incidents"}
          </button>
          {error && <p className="error-text" role="alert">{error}</p>}
        </>
      ) : (
        <>
          <h2>You are available</h2>
          <p>New incidents are assigned to you automatically and open here. Pick any incident in the queue to look at it.</p>
        </>
      )}
    </div>
  );
}
