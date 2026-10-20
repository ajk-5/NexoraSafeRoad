import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "./api";

export const POLL_MS = 5_000;

export interface Polled<T> {
  data: T | undefined;
  error: string | null;
  /** Fetch again now, e.g. right after an action changed the data. */
  reload: () => void;
}

/**
 * Loads data now and every `intervalMs` while the component is shown (the backend
 * has no push channel). `load` is re-created when `deps` change.
 */
export function usePolling<T>(load: () => Promise<T>, deps: readonly unknown[], intervalMs = POLL_MS): Polled<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const run = () => {
      load().then(
        (next) => {
          if (!active) return;
          // Skip re-rendering when nothing changed since the last poll.
          setData((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
          setError(null);
        },
        (failure: unknown) => {
          if (active) setError(errorMessage(failure));
        },
      );
    };
    run();
    const timer = setInterval(run, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // `load` is intentionally keyed by `deps`, not by identity.
  }, [...deps, tick, intervalMs]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, reload };
}
