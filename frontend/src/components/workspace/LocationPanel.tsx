import { Link } from "react-router";

import { mapPath } from "../../paths";
import type { Incident, Role } from "../../types/api";
import { Icon } from "../Icon";
import { LocationMap, type ServiceStation } from "../maps/LocationMap";
import { Card } from "../ui";

interface Props {
  incident: Incident;
  role: Role;
  /** The stations shown with their route line: chosen for the alert, or already alerted. */
  stations: ServiceStation[];
  /** Explains what the station markers are. */
  stationsNote?: string;
}

/** Where it happened, readable even when the map tiles cannot load. */
export function LocationPanel({ incident, role, stations, stationsNote }: Props) {
  return (
    <Card
      title="Location"
      icon="pin"
      className="location-card"
      actions={
        <Link to={mapPath(role, incident.id)} className="btn btn-ghost btn-sm">
          Full map
          <Icon name="external" size="sm" />
        </Link>
      }
    >
      <div className="location-text">
        <strong>{incident.location ?? "No road name from this camera"}</strong>
        <span className="mono small muted">
          {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)} · camera {incident.cameraId}
        </span>
      </div>
      <LocationMap incident={incident} stations={stations} />
      {stations.length > 0 && (
        <p className="map-caption">
          {stationsNote ?? "Dashed lines: straight-line distance to each station."} Drive times are rough estimates. Station
          data © OpenStreetMap contributors.
        </p>
      )}
    </Card>
  );
}
