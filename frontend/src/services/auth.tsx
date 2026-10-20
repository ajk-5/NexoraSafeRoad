import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Operator, Role } from "../types/api";
import { api, hasToken, setToken, setUnauthorizedHandler } from "./api";

const HEARTBEAT_MS = 30_000; // README "Heartbeat": keeps the operator online and their incident locked
const REFRESH_MS = 5_000; // picks up a newly assigned incident quickly

interface Auth {
  operator: Operator | null;
  login: (role: Role, username: string, password: string) => Promise<Operator>;
  logout: () => Promise<void>;
  /** Replace the operator after an action that returns it (pause, resume). */
  update: (operator: Operator) => void;
}

const AuthContext = createContext<Auth | null>(null);

function same(a: Operator | null, b: Operator | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [restoring, setRestoring] = useState(hasToken);

  const update = useCallback((next: Operator | null) => {
    setOperator((previous) => (same(previous, next) ? previous : next));
  }, []);

  useEffect(() => setUnauthorizedHandler(() => update(null)), [update]);

  // Restore the session after a page reload.
  useEffect(() => {
    if (!hasToken()) return;
    api
      .me()
      .then(update, () => setToken(null))
      .finally(() => setRestoring(false));
  }, [update]);

  const signedIn = operator !== null;
  useEffect(() => {
    if (!signedIn) return;
    const ignore = () => {}; // a failed refresh is retried on the next tick
    const beat = () => void api.heartbeat().then(update, ignore);
    const refresh = () => void api.me().then(update, ignore);
    const timers = [setInterval(beat, HEARTBEAT_MS), setInterval(refresh, REFRESH_MS)];
    return () => timers.forEach(clearInterval);
  }, [signedIn, update]);

  const auth = useMemo<Auth>(
    () => ({
      operator,
      update,
      login: async (role, username, password) => {
        const { token, operator: signedInOperator } = await api.login(role, username, password);
        setToken(token);
        update(signedInOperator);
        return signedInOperator;
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          setToken(null);
          update(null);
        }
      },
    }),
    [operator, update],
  );

  if (restoring) return <div className="splash">Loading…</div>;
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (auth === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}

/** The signed-in operator, for pages behind the role guard. */
export function useOperator(): Operator {
  const { operator } = useAuth();
  if (operator === null) throw new Error("useOperator must be used on a signed-in page");
  return operator;
}
