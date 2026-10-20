import { useEffect, useState } from "react";
import { Link } from "react-router";

import { AlertProgress } from "../../components/AlertProgress";
import { IncidentFacts } from "../../components/IncidentFacts";
import { IncidentVideo } from "../../components/IncidentVideo";
import { ServicePicker } from "../../components/ServicePicker";
import { type ServiceStation, StationMap } from "../../components/StationMap";
import { DataState, PageHeader, Panel } from "../../components/ui";
import { aiSummary, formatTime } from "../../format";
import { SERVICE_LABELS, SERVICES } from "../../labels";
import { useIdParam } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { usePolling } from "../../services/usePolling";
import type { Incident, ServiceType, Station, StationChoice } from "../../types/api";

const DECIDED: Incident["status"][] = ["ALERT_SENT", "DECLINED", "IN_PROGRESS", "RESOLVED"];

type NearbyStations = Partial<Record<ServiceType, Station[]>>;

export function AdminIncidentDetails() {
  const id = useIdParam();
  if (id === null) return <div className="notice error">This incident does not exist.</div>;
  // A fresh component per incident, so the service selection never leaks between incidents.
  return <IncidentReview key={id} id={id} />;
}

/** The main decision screen (README "Admin Incident Detail Page"). */
function IncidentReview({ id }: { id: number }) {
  const { data: incident, error, reload } = usePolling(() => api.incident(id), [id]);
  const nearby = useNearbyStations(id);
  const [selection, setSelection] = useState<ServiceType[] | null>(null);
  const [stationPicks, setStationPicks] = useState<StationChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Opening an incident assigned to me starts its review (ASSIGNED -> UNDER_REVIEW).
  const startsReview = incident?.canEdit === true && incident.status === "ASSIGNED";
  useEffect(() => {
    if (startsReview) void api.startReview(id).then(reload, () => {});
  }, [startsReview, id, reload]);

  if (incident === undefined) return <DataState error={error} loading />;

  const selected = selection ?? incident.selectedServices;
  const picks = stationPicks ?? incident.selectedStations;
  const chosen = chosenStations(selected, nearby, picks);
  const decided = DECIDED.includes(incident.status);

  const act = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setConfirmation(done);
      reload();
    } catch (failure) {
      setActionError(errorMessage(failure));
      reload(); // e.g. the lock moved to another admin: show the current state
    } finally {
      setBusy(false);
    }
  };

  const serviceNames = selected.map((s) => SERVICE_LABELS[s]).join(", ");
  const send = () => act(() => api.sendAlert(id, selected, stationIds(chosen)), `Alert sent to ${serviceNames}.`);
  const saveDraft = () => act(() => api.saveDraft(id, selected, stationIds(chosen)), "Draft saved.");
  const decline = () => {
    if (window.confirm(`Decline ${incident.reference}? No service will be alerted.`)) {
      void act(() => api.decline(id), "Incident declined.");
    }
  };

  return (
    <>
      <PageHeader title={incident.reference}>
        <Link to="/admin/incidents" className="button ghost small">
          ← All incidents
        </Link>
      </PageHeader>

      <LockNotice incident={incident} />
      {confirmation && <div className="notice success">{confirmation}</div>}
      {actionError && <div className="notice error">{actionError}</div>}

      <div className="grid-2 detail-top">
        <Panel title="Incident video">
          <IncidentVideo url={incident.videoUrl} cameraId={incident.cameraId} />
        </Panel>
        <Panel title="Incident details">
          <IncidentFacts incident={incident} />
        </Panel>
      </div>

      <Panel title="AI analysis summary">
        <p className="summary">{aiSummary(incident)}</p>
      </Panel>

      {decided ? (
        <Panel title="Response">
          <p className="summary">
            {incident.status === "DECLINED"
              ? `Declined by ${incident.assignedAdmin ?? "an admin"}`
              : `Alert sent by ${incident.assignedAdmin ?? "an admin"}`}
            {incident.decidedAt && ` at ${formatTime(incident.decidedAt)}`}.
          </p>
          {incident.alerts.length > 0 && <AlertProgress alerts={incident.alerts} />}
          {incident.alerts.some((a) => a.station) && (
            <StationsOnMap
              incident={incident}
              stations={incident.alerts.flatMap((a) => (a.station ? [{ service: a.serviceType, station: a.station }] : []))}
            />
          )}
        </Panel>
      ) : (
        <Panel title="AI suggested response">
          <ServicePicker
            suggested={incident.suggestedServices}
            selected={selected}
            onChange={setSelection}
            nearby={nearby}
            chosen={chosen}
            onChooseStation={(service, stationId) => setStationPicks({ ...picks, [service]: stationId })}
            disabled={!incident.canEdit || busy}
          />
          {nearby && (
            <StationsOnMap
              incident={incident}
              stations={SERVICES.flatMap((service) => {
                const station = chosen[service];
                return station ? [{ service, station }] : [];
              })}
            />
          )}
        </Panel>
      )}

      {incident.canEdit && (
        <div className="action-bar">
          <button type="button" className="button primary" onClick={() => void send()} disabled={busy || selected.length === 0}>
            Send alert
          </button>
          <button type="button" className="button danger" onClick={decline} disabled={busy}>
            Decline
          </button>
          <button type="button" className="button secondary" onClick={() => void saveDraft()} disabled={busy}>
            Save draft
          </button>
        </div>
      )}
    </>
  );
}

function StationsOnMap({ incident, stations }: { incident: Incident; stations: ServiceStation[] }) {
  return (
    <div className="station-map">
      <StationMap incident={incident} stations={stations} />
      <p className="map-caption">
        Stations are suggested by straight-line distance; drive times are rough estimates. Station data ©
        OpenStreetMap contributors.
      </p>
    </div>
  );
}

/** Each service's nearest stations. Loaded once: an incident does not move. */
function useNearbyStations(id: number): NearbyStations | undefined {
  const [nearby, setNearby] = useState<NearbyStations>();
  useEffect(() => {
    let active = true;
    // On failure the picker just shows no stations, and the server sends each service's nearest.
    api.incidentStations(id).then(
      (list) => {
        if (!active) return;
        const byService: NearbyStations = {};
        for (const entry of list) byService[entry.service] = entry.stations;
        setNearby(byService);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [id]);
  return nearby;
}

/** The station each selected service responds from: the admin's pick, otherwise the nearest. */
function chosenStations(
  services: ServiceType[],
  nearby: NearbyStations | undefined,
  picks: StationChoice,
): Partial<Record<ServiceType, Station>> {
  const chosen: Partial<Record<ServiceType, Station>> = {};
  for (const service of services) {
    const options = nearby?.[service] ?? [];
    const station = options.find((s) => s.id === picks[service]) ?? options[0];
    if (station) chosen[service] = station;
  }
  return chosen;
}

function stationIds(chosen: Partial<Record<ServiceType, Station>>): StationChoice {
  const ids: StationChoice = {};
  for (const service of SERVICES) {
    const station = chosen[service];
    if (station) ids[service] = station.id;
  }
  return ids;
}

function LockNotice({ incident }: { incident: Incident }) {
  if (incident.status === "WAITING_FOR_OPERATOR") {
    return <div className="notice warning">Waiting for an available admin. It will be assigned automatically.</div>;
  }
  if (!incident.canEdit && (incident.status === "ASSIGNED" || incident.status === "UNDER_REVIEW")) {
    return (
      <div className="notice info">
        Currently handled by <strong>{incident.assignedAdmin}</strong> — read only.
      </div>
    );
  }
  return null;
}
