import { useParams } from "react-router";

import type { Role } from "./types/api";

/** The part of the app each role works in. */
export type Area = "superadmin" | "admin" | "operator";

export function areaOf(role: Role): Area {
  if (role === "SUPERADMIN") return "superadmin";
  return role === "ADMIN" ? "admin" : "operator";
}

/** Each role has its own area: platform administration, the admin console, or the service operators' one. */
export function homePath(role: Role): string {
  return `/${areaOf(role)}`;
}

/** Where an incident opens: the dashboard workspace, or (super admin) a read-only incident page. */
export function workspacePath(role: Role, incidentId: number): string {
  return role === "SUPERADMIN" ? `/superadmin/incidents/${incidentId}` : `${homePath(role)}?incident=${incidentId}`;
}

/** The full map, centred on this incident. */
export function mapPath(role: Role, incidentId?: number): string {
  return `${homePath(role)}/map${incidentId === undefined ? "" : `?incident=${incidentId}`}`;
}

/** A positive integer from a route or query parameter, or null. */
export function parseId(value: string | null | undefined): number | null {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
}

/** The numeric `:id` of the current route, or null if it is not a number. */
export function useIdParam(): number | null {
  return parseId(useParams().id);
}
