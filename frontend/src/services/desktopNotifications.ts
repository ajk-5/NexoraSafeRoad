import { useEffect, useMemo, useSyncExternalStore } from "react";

export type DesktopPermission = NotificationPermission | "unsupported" | "insecure";
const PERMISSION_EVENT = "saferoad-notification-permission";

export function desktopPermission(): DesktopPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  return Notification.permission;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("focus", listener);
  window.addEventListener(PERMISSION_EVENT, listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.removeEventListener("focus", listener);
    window.removeEventListener(PERMISSION_EVENT, listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

export function useDesktopPermission(): DesktopPermission {
  return useSyncExternalStore(subscribe, desktopPermission);
}

/** Call directly from an Enable button or checkbox, never on page load. */
export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() !== "default") return desktopPermission();
  try { await Notification.requestPermission(); } catch { /* Browser may block the prompt. */ }
  window.dispatchEvent(new Event(PERMISSION_EVENT));
  return desktopPermission();
}

export interface DesktopAlert {
  key: string;
  title: string;
  body: string;
  path: string;
}

export function showDesktopNotification(alert: DesktopAlert, open: (path: string) => void): Notification | null {
  if (desktopPermission() !== "granted") return null;
  try {
    const notification = new Notification(alert.title, {
      body: alert.body,
      icon: "/favicon.webp",
      tag: `saferoad-${alert.key}`,
      requireInteraction: true,
      // The application's sound preference controls audio, independently of desktop banners.
      silent: true,
    });
    notification.onclick = () => {
      window.focus();
      open(alert.path);
      notification.close();
    };
    return notification;
  } catch { return null; }
}

function readSeen(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch { return new Set(); }
}

/** One desktop banner per pending assignment/alert, including when the tab is hidden. */
export function useDesktopAlerts(operatorId: number, enabled: boolean, items: DesktopAlert[], open: (path: string) => void): void {
  const permission = useDesktopPermission();
  const state = useMemo(() => {
    const key = `saferoad.desktop-seen.${operatorId}`;
    return { key, seen: readSeen(key), visible: new Map<string, Notification>() };
  }, [operatorId]);

  useEffect(() => {
    const current = new Set(items.map((item) => item.key));
    for (const [key, notification] of state.visible) {
      if (!enabled || permission !== "granted" || !current.has(key)) {
        notification.close();
        state.visible.delete(key);
      }
    }
    let active = true;
    // StrictMode's first effect is cleaned up before this runs, avoiding duplicate toasts.
    queueMicrotask(() => {
      if (!active || !enabled || permission !== "granted") return;
      for (const item of items) {
        if (state.seen.has(item.key)) continue;
        const notification = showDesktopNotification(item, open);
        if (!notification) continue;
        state.visible.set(item.key, notification);
        state.seen.add(item.key);
      }
      try { sessionStorage.setItem(state.key, JSON.stringify([...state.seen].slice(-1_000))); } catch { /* Memory still deduplicates. */ }
    });
    return () => { active = false; };
  }, [state, items, enabled, permission, open]);

  useEffect(() => () => {
    state.visible.forEach((notification) => notification.close());
    state.visible.clear();
  }, [state]);
}
