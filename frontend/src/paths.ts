import { useParams } from "react-router";

import type { Role } from "./types/api";

/** Each role has its own area: the admin interface or the shared service operator one. */
export function homePath(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/operator";
}

/** The numeric `:id` of the current route, or null if it is not a number. */
export function useIdParam(): number | null {
  const id = Number(useParams().id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
