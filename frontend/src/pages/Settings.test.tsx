import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SettingsProvider } from "../services/settings";
import { makeOperator } from "../test/fixtures";
import { Settings } from "./Settings";

vi.mock("../components/ChangePassword", () => ({ ChangePassword: () => null }));
vi.mock("../services/auth", () => ({ useOperator: () => makeOperator() }));
vi.mock("../services/live", () => ({ useLive: () => ({ connected: true }) }));

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

beforeEach(() => {
  localStorage.clear();
  DesktopNotification.permission = "default";
  DesktopNotification.instances = [];
  DesktopNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", DesktopNotification);
  vi.stubGlobal("isSecureContext", true);
});
afterEach(() => { vi.unstubAllGlobals(); });

function renderSettings() {
  render(<MemoryRouter><SettingsProvider operatorId={1}><Settings /></SettingsProvider></MemoryRouter>);
}

it("enables desktop alerts only after a user action, persists the preference and sends a test", async () => {
  renderSettings();
  expect(DesktopNotification.requestPermission).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Enable desktop notifications" }));
  await waitFor(() => expect((screen.getByLabelText("Show desktop notifications on this computer") as HTMLInputElement).checked).toBe(true));
  expect(DesktopNotification.requestPermission).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem("saferoad.settings.1") ?? "{}").desktopNotifications).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Test desktop notification" }));
  expect(DesktopNotification.instances).toHaveLength(1);
  expect(DesktopNotification.instances[0]!.title).toBe("SafeRoad — Desktop notifications ready");
  await userEvent.click(screen.getByLabelText("Show desktop notifications on this computer"));
  expect(JSON.parse(localStorage.getItem("saferoad.settings.1") ?? "{}").desktopNotifications).toBe(false);
});

it("explains blocked notification permissions and does not repeatedly prompt", () => {
  DesktopNotification.permission = "denied";
  renderSettings();
  expect(screen.getByText(/Notifications are blocked/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Enable desktop notifications" }) as HTMLButtonElement).disabled).toBe(true);
  expect(DesktopNotification.requestPermission).not.toHaveBeenCalled();
});

it("requires a secure context and preserves existing sound preferences", () => {
  vi.stubGlobal("isSecureContext", false);
  localStorage.setItem("saferoad.settings.1", JSON.stringify({ sound: false, volume: 0.3, repeat: false }));
  renderSettings();
  expect(screen.getByText("Desktop notifications require HTTPS or localhost.")).toBeTruthy();
  expect((screen.getByLabelText("Play an attention-grabbing sound for incoming alerts") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText("Show desktop notifications on this computer") as HTMLInputElement).checked).toBe(false);
});
