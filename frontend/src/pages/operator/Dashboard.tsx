import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { Icon } from "../../components/Icon";
import { AlertQueue } from "../../components/queue/AlertQueue";
import { OperatorWorkspace } from "../../components/workspace/OperatorWorkspace";
import { parseAlertFilter, type AlertFilter } from "../../domain/alerts";
import { SERVICE_LABELS, serviceOf } from "../../labels";
import { parseId } from "../../paths";
import { useOperator } from "../../services/auth";
import { useLive } from "../../services/live";

/** A service operator's workspace: new alerts on the left, the selected incident on the right. */
export function OperatorDashboard() {
  const operator = useOperator();
  const { alerts } = useLive();
  const [params, setParams] = useSearchParams();
  const explicitId = parseId(params.get("incident"));
  const selectedId = explicitId ?? operator.currentIncidentId;
  const workspaceRef = useRef<HTMLDivElement>(null);
  // A newly chosen incident starts at its top, not where the previous one was scrolled to.
  useEffect(() => {
    workspaceRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 }); // phones scroll the page itself
  }, [selectedId]);
  const ownService = serviceOf(operator.role);
  const service = ownService ? SERVICE_LABELS[ownService] : "";
  // The queue's filter lives in the address bar, so it survives a reload and the Back button.
  const filter = parseAlertFilter(params.get("filter")) ?? "all";
  const withFilter = (next: AlertFilter) => {
    const target = new URLSearchParams(params);
    if (next === "all") target.delete("filter");
    else target.set("filter", next);
    return target;
  };
  const fresh = (alerts.data ?? []).filter((a) => a.status === "SENT").length;

  return (
    <div className={`page-bleed dashboard${explicitId !== null ? " has-selection" : ""}`}>
      <div className="dashboard-body">
        <AlertQueue
          alerts={alerts.data}
          error={alerts.error}
          onRetry={alerts.reload}
          operator={operator}
          selectedIncidentId={selectedId}
          linkFor={(id) => {
            const target = new URLSearchParams(params);
            target.set("incident", String(id));
            return `?${target.toString()}`;
          }}
          filter={filter}
          onFilter={(next) => setParams(withFilter(next), { replace: true })}
        />
        <div className="workspace-area" ref={workspaceRef}>
          {selectedId === null ? (
            <div className="idle-workspace card">
              <div className={`idle-icon${operator.status === "PAUSED" ? " paused" : ""}`}>
                <Icon name={operator.status === "PAUSED" ? "pause" : "shieldCheck"} size="lg" />
              </div>
              <h2>{operator.status === "PAUSED" ? "You are paused" : "No intervention in progress"}</h2>
              <p>
                {operator.status === "PAUSED"
                  ? "You cannot accept new alerts while paused. Resume from the top bar when you are ready."
                  : fresh > 0
                    ? "Open a new alert on the left, check the clip and location, then accept it."
                    : `New ${service} alerts appear on the left as soon as an operator sends them.`}
              </p>
            </div>
          ) : (
            <OperatorWorkspace key={selectedId} id={selectedId} />
          )}
        </div>
      </div>
    </div>
  );
}
