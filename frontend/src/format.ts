import type { Alert, Incident, Station, TrainingJob } from "./types/api";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "Mon 13" for a "2026-10-13" date. */
export function formatDay(isoDate: string): string {
  return dayFormat.format(new Date(`${isoDate}T12:00:00`));
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Same rule as the backend's `Incident.reference`: incident 1 is "INC-1001". */
export function incidentReference(id: number): string {
  return `INC-${1000 + id}`;
}

/** The road label when the camera has one, otherwise GPS coordinates. */
export function locationLabel(place: { location: string | null; latitude: number; longitude: number }): string {
  return place.location ?? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return meters < 10_000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 1000)} km`;
}

/** "1.2 km · ~3 min": straight-line distance and a rough driving time. */
export function stationDistance(station: Station): string {
  return `${formatDistance(station.distanceM)} · ~${station.etaMinutes} min`;
}

/** One plain-language sentence about what the AI saw (no technical details). */
export function aiSummary(incident: Incident): string {
  const parts = [
    `${incident.vehicles} vehicle${incident.vehicles === 1 ? "" : "s"}`,
    `${incident.people} ${incident.people === 1 ? "person" : "people"} visible`,
  ];
  if (incident.fire) parts.push("fire detected");
  if (incident.overturned) parts.push("overturned vehicle");
  return `Possible accident (${percent(incident.confidence)} confidence): ${parts.join(", ")}.`;
}

/** A short line for alert lists, e.g. "3 vehicles · possible injuries". */
export function alertDescription(alert: Alert): string {
  const vehicles = `${alert.vehicles} vehicle${alert.vehicles === 1 ? "" : "s"}`;
  return alert.possibleInjuries ? `${vehicles} · possible injuries` : vehicles;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} kB`;
  if (bytes < 1e9) return `${Math.round(bytes / 1e6)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

/** A 0–1 metric as a percentage, "—" when unknown. */
export function formatMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}

/** Best validation mAP50 a training job reached so far. */
export function bestMap50(job: TrainingJob): number | null {
  const values = job.history.map((h) => h.map50).filter((v): v is number => v !== null);
  return job.finalMetrics?.map50 ?? (values.length ? Math.max(...values) : null);
}
