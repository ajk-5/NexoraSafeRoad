import { useState } from "react";
import { Link } from "react-router";

import { AcceptAlertButton } from "../../components/AcceptAlertButton";
import { AlertProgress } from "../../components/AlertProgress";
import { AlertStatusBadge } from "../../components/Badges";
import { IncidentFacts } from "../../components/IncidentFacts";
import { IncidentVideo } from "../../components/IncidentVideo";
import { StationMap } from "../../components/StationMap";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { aiSummary, stationDistance } from "../../format";
import { NEXT_STEP, SERVICE_LABELS } from "../../labels";
import { useIdParam } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { useAuth, useOperator } from "../../services/auth";
import { usePolling } from "../../services/usePolling";
import type { Alert, AlertUpdate, Incident } from "../../types/api";

export function OperatorIncidentDetails() {
  const id = useIdParam();
  if (id === null) return <div className="notice error">This incident does not exist.</div>;
  return <Intervention key={id} id={id} />;
}

/** README "Service Operator Incident Page" with the intervention status buttons. */
function Intervention({ id }: { id: number }) {
  const operator = useOperator();
  const { update } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The incident, plus this service's alert with the accept/update permissions.
  const { data, error, reload } = usePolling(async (): Promise<{ incident: Incident; alert: Alert | null }> => {
    const incident = await api.incident(id);
    const ours = incident.alerts.find((a) => a.serviceType === operator.role);
    return { incident, alert: ours ? await api.alert(ours.id) : null };
  }, [id, operator.role]);

  if (data === undefined) return <DataState error={error} loading />;
  const { incident, alert } = data;
  const next = alert?.canUpdate ? NEXT_STEP[alert.status] : undefined;

  const advance = async (status: AlertUpdate) => {
    if (alert === null) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.updateAlert(alert.id, status);
      if (status === "RESOLVED") update(await api.me()); // free for the next intervention
      reload();
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={incident.reference}>
        <Link to="/operator/incidents" className="button ghost small">
          ← All incidents
        </Link>
      </PageHeader>
      {actionError && <div className="notice error">{actionError}</div>}

      <div className="grid-2 detail-top">
        <Panel title="Incident video">
          <IncidentVideo url={incident.videoUrl} cameraId={incident.cameraId} />
        </Panel>
        <Panel title="Incident details">
          <IncidentFacts incident={incident} />
        </Panel>
      </div>

      <Panel title="Description">
        <p className="summary">{aiSummary(incident)}</p>
      </Panel>

      {alert && (
        <Panel title={`${SERVICE_LABELS[alert.serviceType]} intervention`}>
          <div className="intervention-status">
            <AlertStatusBadge status={alert.status} />
            <span className="muted">
              {alert.assignedOperator ? `Handled by ${alert.assignedOperator}` : "Not accepted yet"}
            </span>
          </div>
          {alert.station && (
            <div className="responding-station">
              <p>
                Responding station: <strong>{alert.station.name}</strong>
                {alert.station.address && <span className="muted"> · {alert.station.address}</span>}
                <br />
                <span className="muted">{stationDistance(alert.station)} from the incident (rough estimate)</span>
              </p>
              <StationMap incident={incident} stations={[{ service: alert.serviceType, station: alert.station }]} height={260} />
            </div>
          )}
          <div className="action-bar inline">
            {alert.canAccept && <AcceptAlertButton alertId={alert.id} incidentId={incident.id} onError={setActionError} />}
            {next && (
              <button type="button" className="button primary" onClick={() => void advance(next.status)} disabled={busy}>
                {next.label}
              </button>
            )}
            {next && next.status !== "RESOLVED" && (
              <button type="button" className="button secondary" onClick={() => void advance("RESOLVED")} disabled={busy}>
                Mark resolved
              </button>
            )}
          </div>
        </Panel>
      )}

      <Panel title="All services on this incident">
        <AlertProgress alerts={incident.alerts} />
      </Panel>
    </>
  );
}
