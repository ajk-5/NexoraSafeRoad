import { useSyncExternalStore } from "react";

/**
 * Whether the backend is reachable, from the outcome of every API call. The header shows it so
 * an operator never mistakes old data for live data.
 */
export interface ConnectionState {
  /** Time of the last successful response, or null before the first one. */
  lastOk: number | null;
  /** True after a request failed to reach the server, until the next success. */
  failing: boolean;
}

let state: ConnectionState = { lastOk: null, failing: false };
const listeners = new Set<() => void>();

function set(next: ConnectionState): void {
  if (next.lastOk === state.lastOk && next.failing === state.failing) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function reportSuccess(now: number = Date.now()): void {
  set({ lastOk: now, failing: false });
}

/** A request did not reach the server (network down, backend stopped or crashing). */
export function reportFailure(): void {
  set({ ...state, failing: true });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribe, () => state);
}
