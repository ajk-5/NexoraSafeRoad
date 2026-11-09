import { divIcon, type DivIcon } from "leaflet";
import { useState } from "react";
import { TileLayer } from "react-leaflet";

import { SERVICE_COLORS, SERVICE_TAGS, SEVERITY_LETTERS } from "../../labels";
import type { ServiceType, Severity } from "../../types/api";

export const PARIS: [number, number] = [48.8566, 2.3522];

/**
 * OpenStreetMap tiles. Reports when tiles fail to load (offline, blocked), so the page can say
 * so: the location is always written out next to the map as well.
 */
export function BaseTiles({ onStatus }: { onStatus: (failing: boolean) => void }) {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      eventHandlers={{ tileerror: () => onStatus(true), tileload: () => onStatus(false) }}
    />
  );
}

/** Tracks tile failures for <BaseTiles>; true once a tile failed and none loaded since. */
export function useTileStatus(): [boolean, (failing: boolean) => void] {
  return useState(false);
}

export function TilesFailedNotice() {
  return (
    <div className="map-tiles-failed" role="status">
      Map tiles could not be loaded. The location is given as text above.
    </div>
  );
}

// Icons are built once per look and reused, so markers are not recreated on every poll.
// Only constant text and colours go into this HTML, never data from the backend.
const icons = new Map<string, DivIcon>();

export function severityIcon(severity: Severity, selected = false): DivIcon {
  const key = `sev-${severity}-${selected}`;
  let icon = icons.get(key);
  if (!icon) {
    const size = selected ? 34 : 26;
    icon = divIcon({
      className: "sev-pin-wrap",
      html: `<span class="sev-pin sev-pin-${severity.toLowerCase()}${selected ? " selected" : ""}">${SEVERITY_LETTERS[severity]}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    icons.set(key, icon);
  }
  return icon;
}

export function stationIcon(service: ServiceType): DivIcon {
  const key = `station-${service}`;
  let icon = icons.get(key);
  if (!icon) {
    icon = divIcon({
      className: "station-marker",
      html: `<span style="background:${SERVICE_COLORS[service]}">${SERVICE_TAGS[service]}</span>`,
      iconSize: [46, 22],
      iconAnchor: [23, 11],
    });
    icons.set(key, icon);
  }
  return icon;
}

/** Whether map movements should animate (off when the operator prefers reduced motion). */
export function animateMap(): boolean {
  return typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
