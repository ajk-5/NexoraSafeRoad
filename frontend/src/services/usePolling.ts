import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "./api";

export const POLL_MS = 5_000;
/** Longest wait between two attempts while the server keeps failing. */
const MAX_BACKOFF_MS = 30_000;

export interface Polled<T> {
  data: T | undefined;
  /** The last load failed; `data`, if any, is from an earlier load and may be out of date. */
  error: string | null;
  /** When `data` was last loaded successfully. */
  updatedAt: number | null;
  /** Fetch again now, e.g. right after an action changed the data. */
  reload: () => void;
}

/**
 * Loads data now and every `intervalMs` while the component is shown, with explicit reloads
 * for live changes and user actions. `load` is re-created when `deps` change.
 *
 * - Never two requests at once: the next one is scheduled when the previous one ends.
 * - Backs off while requests fail (5 s, 10 s, 20 s, then every 30 s) and resets on success.
 * - Stops while the browser tab is hidden and reloads as soon as it is shown again.
 */
export function usePolling<T>(load: () => Promise<T>, deps: readonly unknown[], intervalMs = POLL_MS): Polled<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!active || document.hidden) return; // `onVisible` starts again
      const delay = Math.min(intervalMs * 2 ** failures, Math.max(MAX_BACKOFF_MS, intervalMs));
      timer = setTimeout(run, delay);
    };

    function run() {
      if (!active || inFlight) return;
      inFlight = true;
      load()
        .then(
          (next) => {
            if (!active) return;
            failures = 0;
            // Skip re-rendering when nothing changed since the last poll.
            setData((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
            setError(null);
            setUpdatedAt(Date.now());
          },
          (failure: unknown) => {
            if (!active) return;
            failures += 1;
            setError(errorMessage(failure));
          },
        )
        .finally(() => {
          inFlight = false;
          schedule();
        });
    }

    const onVisible = () => {
      if (document.hidden || !active) return;
      clearTimeout(timer);
      run();
    };

    document.addEventListener("visibilitychange", onVisible);
    run();
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `load` is intentionally keyed by `deps`, not by identity.
  }, [...deps, tick, intervalMs]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, updatedAt, reload };
}
