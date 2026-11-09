import { Link } from "react-router";

import { homePath } from "../../paths";
import { api } from "../../services/api";
import { useAuth, useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import { usePolling } from "../../services/usePolling";
import type { Alert, Incident } from "../../types/api";
import { AlertProgress } from "../AlertProgress";
import { Icon } from "../Icon";
import { Card, ErrorState, StaleNotice } from "../ui";
import { AIInsights } from "./AIInsights";
import { IncidentSummary } from "./IncidentSummary";
import { IncidentTimeline } from "./IncidentTimeline";
import { InterventionPanel } from "./InterventionPanel";
import { LocationPanel } from "./LocationPanel";
import { VideoEvidencePlayer } from "./VideoEvidencePlayer";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";

/** A service operator's view of one incident: the evidence, where to go, and their intervention. */
export function OperatorWorkspace({ id }: { id: number }) {
  const operator = useOperator();
  const { update } = useAuth();
  const live = useLive();
  // The incident, plus this service's alert with the accept/update permissions.
  const { data, error, reload } = usePolling(async (): Promise<{ incident: Incident; alert: Alert | null }> => {
    const incident = await api.incident(id);
    const ours = incident.alerts.find((a) => a.serviceType === operator.role);
    return { incident, alert: ours ? await api.alert(ours.id) : null };
  }, [id, operator.role]);

  if (data === undefined) {
    return error ? <ErrorState title="Could not load this incident" message={error} onRetry={reload} /> : <WorkspaceSkeleton />;
  }
  const { incident, alert } = data;

  const refresh = () => {
    reload();
    live.alerts.reload();
    live.incidents.reload();
    void api.me().then(update, () => {}); // BUSY after accepting, free after resolving
  };

  return (
    <article className="workspace" aria-labelledby="ws-title">
      <Link to={homePath(operator.role)} className="btn btn-ghost btn-sm ws-back">
        <Icon name="chevronLeft" size="sm" />
        Back to alerts
      </Link>
      {error && <StaleNotice message={error} onRetry={reload} />}
      <IncidentSummary
        incident={incident}
        handledBy={alert?.canUpdate ? "You" : (alert?.assignedOperator ?? null)}
        headingId="ws-title"
      />
      <div className="workspace-grid">
        <div className="ws-col ws-col-main">
          <div className="ws-area-video">
            <VideoEvidencePlayer url={incident.videoUrl} cameraId={incident.cameraId} detectedAt={incident.detectedAt} />
          </div>
          <div className="ws-area-ai">
            <AIInsights incident={incident} />
          </div>
          <div className="ws-area-timeline">
            {incident.alerts.length > 1 && (
              <Card title="All services on this incident" icon="users">
                <AlertProgress alerts={incident.alerts} />
              </Card>
            )}
            <IncidentTimeline incident={incident} />
          </div>
        </div>
        <div className="ws-col ws-col-side">
          <div className="ws-area-decision">
            <InterventionPanel alert={alert} operator={operator} incidentId={incident.id} onChanged={refresh} />
          </div>
          <div className="ws-area-location">
            <LocationPanel
              incident={incident}
              role={operator.role}
              stations={alert?.station ? [{ service: alert.serviceType, station: alert.station }] : []}
              stationsNote="Marker: your responding station."
            />
          </div>
        </div>
      </div>
    </article>
  );
}
