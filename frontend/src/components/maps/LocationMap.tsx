import { latLngBounds } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";

import { stationDistance } from "../../format";
import { SERVICE_COLORS, SERVICE_LABELS } from "../../labels";
import type { Incident, ServiceType, Station } from "../../types/api";
import { BaseTiles, severityIcon, stationIcon, TilesFailedNotice, useTileStatus } from "./mapParts";

export interface ServiceStation {
  service: ServiceType;
  station: Station;
}

interface Props {
  incident: Pick<Incident, "latitude" | "longitude" | "severity" | "reference">;
  /** Stations responding (or proposed), each linked to the incident by a straight line. */
  stations?: ServiceStation[];
  height?: number;
}

/** A compact map of one incident. Scroll-wheel zoom is off so the page scrolls normally. */
export function LocationMap({ incident, stations = [], height = 240 }: Props) {
  const center: [number, number] = [incident.latitude, incident.longitude];
  const [tilesFailed, setTilesFailed] = useTileStatus();
  return (
    <div className="map" style={{ height }}>
      <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: "100%" }}>
        <BaseTiles onStatus={setTilesFailed} />
        {stations.map(({ service, station }) => (
          <Polyline
            key={`line-${service}`}
            positions={[[station.latitude, station.longitude], center]}
            pathOptions={{ color: SERVICE_COLORS[service], weight: 3, dashArray: "6 8", opacity: 0.8 }}
          />
        ))}
        {stations.map(({ service, station }) => (
          <Marker key={service} position={[station.latitude, station.longitude]} icon={stationIcon(service)}>
            <Tooltip direction="top" offset={[0, -12]}>
              <strong>{SERVICE_LABELS[service]}</strong>: {station.name}
              <br />
              {stationDistance(station)}
            </Tooltip>
          </Marker>
        ))}
        <Marker position={center} icon={severityIcon(incident.severity, true)} keyboard={false}>
          <Tooltip direction="top" offset={[0, -16]}>
            {incident.reference}
          </Tooltip>
        </Marker>
        <FitToPoints points={[center, ...stations.map((s): [number, number] => [s.station.latitude, s.station.longitude])]} />
      </MapContainer>
      {tilesFailed && <TilesFailedNotice />}
    </div>
  );
}

/** Keep the incident and every station in view, also after another station is picked. */
function FitToPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const [first] = points;
    if (points.length === 1 && first) map.setView(first, 15, { animate: false });
    else map.fitBounds(latLngBounds(points), { padding: [32, 32], maxZoom: 16, animate: false });
    // `key` stands for `points`, which is a new array on every render.
  }, [key, map]);
  return null;
}
