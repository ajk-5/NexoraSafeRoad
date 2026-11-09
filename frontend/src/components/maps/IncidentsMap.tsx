import { latLngBounds } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";

import { SEVERITY_LABELS } from "../../labels";
import type { Incident } from "../../types/api";
import { animateMap, BaseTiles, PARIS, severityIcon, TilesFailedNotice, useTileStatus } from "./mapParts";

interface Props {
  incidents: Incident[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Every incident as a severity marker (letter + colour). The map is created once and kept. */
export function IncidentsMap({ incidents, selectedId, onSelect }: Props) {
  const [tilesFailed, setTilesFailed] = useTileStatus();
  const selected = incidents.find((i) => i.id === selectedId);
  return (
    <div className="map map-fill">
      <MapContainer center={PARIS} zoom={12} scrollWheelZoom style={{ height: "100%" }}>
        <BaseTiles onStatus={setTilesFailed} />
        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.latitude, incident.longitude]}
            icon={severityIcon(incident.severity, incident.id === selectedId)}
            title={`${incident.reference}, ${SEVERITY_LABELS[incident.severity]} severity`}
            alt={`${incident.reference}, ${SEVERITY_LABELS[incident.severity]} severity`}
            zIndexOffset={incident.id === selectedId ? 1000 : incident.severity === "HIGH" ? 100 : 0}
            eventHandlers={{ click: () => onSelect(incident.id) }}
          />
        ))}
        <FitOnce incidents={incidents} skip={selected !== undefined} />
        {selected && <FocusSelected incident={selected} />}
      </MapContainer>
      {tilesFailed && <TilesFailedNotice />}
    </div>
  );
}

/** Zoom to the incidents once, when they first load; then the view belongs to the operator. */
function FitOnce({ incidents, skip }: { incidents: Incident[]; skip: boolean }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || incidents.length === 0) return;
    fitted.current = true;
    if (skip) return;
    const points = incidents.map((i): [number, number] => [i.latitude, i.longitude]);
    if (points.length === 1 && points[0]) map.setView(points[0], 15, { animate: false });
    else map.fitBounds(latLngBounds(points), { padding: [48, 48], maxZoom: 15, animate: false });
  }, [incidents, map, skip]);
  return null;
}

/** Bring the selected incident into view when the selection changes (not on every poll). */
function FocusSelected({ incident }: { incident: Incident }) {
  const map = useMap();
  useEffect(() => {
    const target: [number, number] = [incident.latitude, incident.longitude];
    const zoom = Math.max(map.getZoom(), 14);
    if (animateMap()) map.flyTo(target, zoom, { duration: 0.6 });
    else map.setView(target, zoom, { animate: false });
    // Only when another incident is selected.
  }, [incident.id, map]);
  return null;
}
