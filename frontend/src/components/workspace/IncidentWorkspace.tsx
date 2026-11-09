import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { SERVICES } from "../../labels";
import { homePath } from "../../paths";
import { api } from "../../services/api";
import { useAuth, useOperator } from "../../services/auth";
import { useLive } from "../../services/live";
import { usePolling } from "../../services/usePolling";
import type { Incident, ServiceType, Station, StationChoice } from "../../types/api";
import { Icon } from "../Icon";
import type { ServiceStation } from "../maps/LocationMap";
import { ErrorState, StaleNotice } from "../ui";
import { AIInsights } from "./AIInsights";
import { DecisionPanel } from "./DecisionPanel";
import { IncidentSummary } from "./IncidentSummary";
import { IncidentTimeline } from "./IncidentTimeline";
import { LocationPanel } from "./LocationPanel";
import { VideoEvidencePlayer } from "./VideoEvidencePlayer";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";

type NearbyStations = Partial<Record<ServiceType, Station[]>>;

/**
 * Everything needed to decide on one incident, on one screen: evidence, AI assessment, location,
 * services and the decision. Mount it with `key={id}` so nothing carries over between incidents.
 */
export function IncidentWorkspace({ id, backTo, backLabel = "Back to the queue" }: { id: number; backTo?: string; backLabel?: string }) {
  const operator = useOperator();
  const { update } = useAuth();
  const live = useLive();
  const { data: incident, error, reload } = usePolling(() => api.incident(id), [id]);
  // Only admins choose stations; the super admin's view is read-only.
  const nearby = useNearbyStations(id, operator.role === "ADMIN");
  const [selection, setSelection] = useState<ServiceType[] | null>(null);
  const [stationPicks, setStationPicks] = useState<StationChoice | null>(null);

  // Opening an incident assigned to me starts its review (ASSIGNED -> UNDER_REVIEW).
  const startsReview = incident?.canEdit === true && incident.status === "ASSIGNED";
  useEffect(() => {
    if (!startsReview) return;
    void api.startReview(id).then(() => {
      reload();
      live.incidents.reload(); // the queue shows "Being reviewed" straight away
    }, () => {});
    // `live.incidents.reload` is stable.
  }, [startsReview, id, reload]);

  const selected = selection ?? incident?.selectedServices ?? [];
  const picks = stationPicks ?? incident?.selectedStations ?? {};
  const chosen = useMemo(() => chosenStations(selected, nearby, picks), [selected, nearby, picks]);

  if (incident === undefined) {
    return error ? <ErrorState title="Could not load this incident" message={error} onRetry={reload} /> : <WorkspaceSkeleton />;
  }

  const refresh = () => {
    reload();
    live.incidents.reload();
    // A decision frees the admin, and the backend may hand them the next incident at once.
    void api.me().then(update, () => {});
  };
  const editing = incident.canEdit && (incident.status === "ASSIGNED" || incident.status === "UNDER_REVIEW");
  const mapStations = editing ? toServiceStations(chosen) : dispatchedStations(incident);

  return (
    <article className="workspace" aria-labelledby="ws-title">
      <Link to={backTo ?? homePath(operator.role)} className={`btn btn-ghost btn-sm ws-back${backTo ? " always" : ""}`}>
        <Icon name="chevronLeft" size="sm" />
        {backLabel}
      </Link>
      {error && <StaleNotice message={error} onRetry={reload} />}
      <IncidentSummary incident={incident} handledBy={incident.canEdit ? "You" : incident.assignedAdmin} headingId="ws-title" />
      <div className="workspace-grid">
        <div className="ws-col ws-col-main">
          <div className="ws-area-video">
            <VideoEvidencePlayer url={incident.videoUrl} cameraId={incident.cameraId} detectedAt={incident.detectedAt} />
          </div>
          <div className="ws-area-ai">
            <AIInsights incident={incident} />
          </div>
          <div className="ws-area-timeline">
            <IncidentTimeline incident={incident} />
          </div>
        </div>
        <div className="ws-col ws-col-side">
          <div className="ws-area-decision">
            <DecisionPanel
              incident={incident}
              viewer={operator}
              selected={selected}
              onSelect={setSelection}
              nearby={nearby}
              chosen={chosen}
              onChooseStation={(service, stationId) => setStationPicks({ ...picks, [service]: stationId })}
              onChanged={refresh}
            />
          </div>
          <div className="ws-area-location">
            <LocationPanel
              incident={incident}
              role={operator.role}
              stations={mapStations}
              stationsNote={editing ? "Markers: the station each selected service would respond from." : "Markers: the stations alerted."}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Each service's nearest stations. Loaded once: an incident does not move. */
function useNearbyStations(id: number, enabled: boolean): NearbyStations | undefined {
  const [nearby, setNearby] = useState<NearbyStations>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // On failure the selector shows no stations, and the server sends each service's nearest.
    api.incidentStations(id).then(
      (list) => {
        if (!active) return;
        const byService: NearbyStations = {};
        for (const entry of list) byService[entry.service] = entry.stations;
        setNearby(byService);
      },
      () => active && setNearby({}),
    );
    return () => {
      active = false;
    };
  }, [id, enabled]);
  return nearby;
}

/** The station each selected service responds from: the admin's pick, otherwise the nearest. */
function chosenStations(services: ServiceType[], nearby: NearbyStations | undefined, picks: StationChoice): Partial<Record<ServiceType, Station>> {
  const chosen: Partial<Record<ServiceType, Station>> = {};
  for (const service of services) {
    const options = nearby?.[service] ?? [];
    const station = options.find((s) => s.id === picks[service]) ?? options[0];
    if (station) chosen[service] = station;
  }
  return chosen;
}

function toServiceStations(chosen: Partial<Record<ServiceType, Station>>): ServiceStation[] {
  return SERVICES.flatMap((service) => {
    const station = chosen[service];
    return station ? [{ service, station }] : [];
  });
}

function dispatchedStations(incident: Incident): ServiceStation[] {
  return incident.alerts.flatMap((a) => (a.station ? [{ service: a.serviceType, station: a.station }] : []));
}
