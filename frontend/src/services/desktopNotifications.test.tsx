import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { desktopPermission, requestDesktopPermission, showDesktopNotification, useDesktopAlerts, type DesktopAlert } from "./desktopNotifications";

class DesktopNotification {
  static permission: NotificationPermission = "default";
  static instances: DesktopNotification[] = [];
  static requestPermission = vi.fn(async () => {
    DesktopNotification.permission = "granted";
    return "granted" as const;
  });
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(public title: string, public options: NotificationOptions) { DesktopNotification.instances.push(this); }
}

const alert: DesktopAlert = { key: "1-alert-5", title: "New emergency alert", body: "INC-1005", path: "/operator?incident=5" };

beforeEach(() => {
  sessionStorage.clear();
  DesktopNotification.permission = "default";
  DesktopNotification.instances = [];
  DesktopNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", DesktopNotification);
  vi.stubGlobal("isSecureContext", true);
  vi.spyOn(window, "focus").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("requests permission explicitly and never sends without permission", async () => {
  expect(showDesktopNotification(alert, vi.fn())).toBeNull();
  expect(DesktopNotification.requestPermission).not.toHaveBeenCalled();
  expect(await requestDesktopPermission()).toBe("granted");
  expect(DesktopNotification.requestPermission).toHaveBeenCalledTimes(1);
  expect(await requestDesktopPermission()).toBe("granted");
  expect(DesktopNotification.requestPermission).toHaveBeenCalledTimes(1);
});

it("reports insecure and unsupported contexts without requesting permission", async () => {
  vi.stubGlobal("isSecureContext", false);
  expect(desktopPermission()).toBe("insecure");
  expect(await requestDesktopPermission()).toBe("insecure");
  expect(DesktopNotification.requestPermission).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  expect(desktopPermission()).toBe("unsupported");
});

it("creates an OS notification and opens the incident when clicked", () => {
  DesktopNotification.permission = "granted";
  const open = vi.fn();
  expect(showDesktopNotification(alert, open)).toBeTruthy();
  const notification = DesktopNotification.instances[0]!;
  expect(notification.options).toMatchObject({ tag: "saferoad-1-alert-5", requireInteraction: true, silent: true });
  notification.onclick?.();
  expect(window.focus).toHaveBeenCalled();
  expect(open).toHaveBeenCalledWith("/operator?incident=5");
  expect(notification.close).toHaveBeenCalled();
});

it("deduplicates polls and reloads, including StrictMode and hidden tabs", async () => {
  DesktopNotification.permission = "granted";
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const open = vi.fn();
  const { rerender, unmount } = renderHook(({ items }) => useDesktopAlerts(1, true, items, open), {
    initialProps: { items: [alert] }, wrapper: StrictMode,
  });
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(1);
  rerender({ items: [{ ...alert }] });
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(1);
  rerender({ items: [] });
  expect(DesktopNotification.instances[0]!.close).toHaveBeenCalled();
  unmount();
  renderHook(() => useDesktopAlerts(1, true, [alert], open));
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(1);
});

it("honors the opt-out and permission denial without losing future alerts", async () => {
  DesktopNotification.permission = "denied";
  const open = vi.fn();
  const { rerender } = renderHook(({ enabled }) => useDesktopAlerts(1, enabled, [alert], open), { initialProps: { enabled: true } });
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(0);
  DesktopNotification.permission = "granted";
  rerender({ enabled: false });
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(0);
  rerender({ enabled: true });
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(1);
});

it("keeps account notification history separate and closes on sign-out", async () => {
  DesktopNotification.permission = "granted";
  const open = vi.fn();
  const { unmount } = renderHook(() => useDesktopAlerts(1, true, [alert], open));
  await act(async () => {});
  unmount();
  expect(DesktopNotification.instances[0]!.close).toHaveBeenCalled();
  renderHook(() => useDesktopAlerts(2, true, [alert], open));
  await act(async () => {});
  expect(DesktopNotification.instances).toHaveLength(2);
});
