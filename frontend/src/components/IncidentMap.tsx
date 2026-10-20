import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "react-router";

import { formatTime, locationLabel } from "../format";
import { INCIDENT_STATUS_LABELS, SEVERITY_COLORS } from "../labels";
import type { Incident } from "../types/api";

const PARIS: [number, number] = [48.8566, 2.3522];

interface Props {
  incidents: Incident[];
  /** Where clicking an incident goes, e.g. "/admin/incidents". */
  linkBase: string;
  height?: number;
  selectedId?: number;
}

export function IncidentMap({ incidents, linkBase, height = 360, selectedId }: Props) {
  return (
    <div className="map" style={{ height }}>
      <MapContainer center={PARIS} zoom={12} scrollWheelZoom style={{ height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {incidents.map((incident) => (
          <CircleMarker
            key={incident.id}
            center={[incident.latitude, incident.longitude]}
            radius={incident.id === selectedId ? 14 : 10}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: SEVERITY_COLORS[incident.severity],
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{incident.reference}</strong> · {incident.severity}
                <div>{locationLabel(incident)}</div>
                <div>
                  {INCIDENT_STATUS_LABELS[incident.status]} · {formatTime(incident.detectedAt)}
                </div>
                {incident.id !== selectedId && <Link to={`${linkBase}/${incident.id}`}>Open incident</Link>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <FitToIncidents incidents={incidents} />
      </MapContainer>
    </div>
  );
}

/** Zoom to the incidents once, when they first load, then leave the view to the operator. */
function FitToIncidents({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || incidents.length === 0) return;
    fitted.current = true;
    const points = incidents.map((i): [number, number] => [i.latitude, i.longitude]);
    if (points.length === 1 && points[0]) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [incidents, map]);
  return null;
}
