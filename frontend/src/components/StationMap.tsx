import { divIcon, latLngBounds } from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

import { stationDistance } from "../format";
import { SERVICE_COLORS, SERVICE_LABELS, SERVICE_TAGS, SEVERITY_COLORS } from "../labels";
import type { Incident, ServiceType, Station } from "../types/api";

export interface ServiceStation {
  service: ServiceType;
  station: Station;
}

interface Props {
  incident: Pick<Incident, "latitude" | "longitude" | "severity" | "reference">;
  stations: ServiceStation[];
  height?: number;
}

/** The incident and the stations called to it, each linked to the incident by a straight line. */
export function StationMap({ incident, stations, height = 300 }: Props) {
  const center: [number, number] = [incident.latitude, incident.longitude];
  return (
    <div className="map" style={{ height }}>
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
        <CircleMarker
          center={center}
          radius={12}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: SEVERITY_COLORS[incident.severity], fillOpacity: 0.95 }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {incident.reference}
          </Tooltip>
        </CircleMarker>
        <FitToPoints points={[center, ...stations.map((s): [number, number] => [s.station.latitude, s.station.longitude])]} />
      </MapContainer>
    </div>
  );
}

function stationIcon(service: ServiceType) {
  // Constant text and colours only: nothing from the backend goes into this HTML.
  return divIcon({
    className: "station-marker",
    html: `<span style="background:${SERVICE_COLORS[service]}">${SERVICE_TAGS[service]}</span>`,
    iconSize: [44, 22],
    iconAnchor: [22, 11],
  });
}

/** Keep the incident and every station in view, also after the admin picks another station. */
function FitToPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const [first] = points;
    if (points.length === 1 && first) map.setView(first, 15);
    else map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
    // `key` stands for `points`, which is a new array on every render.
  }, [key, map]);
  return null;
}
