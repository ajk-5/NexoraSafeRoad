import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { makeAlert, makeIncident, makeOperator } from "../test/fixtures";
import { AlertAttention } from "./AlertAttention";

const mocks = vi.hoisted(() => ({
  live: { incidents: { data: [] as ReturnType<typeof makeIncident>[] }, alerts: { data: [] as ReturnType<typeof makeAlert>[] } },
  settings: { desktopNotifications: false, sound: true, volume: 0.8, repeat: true },
  play: vi.fn(() => true), stop: vi.fn(), desktop: vi.fn(),
}));
vi.mock("../services/live", () => ({ useLive: () => mocks.live }));
vi.mock("../services/settings", () => ({ useSettings: () => ({ settings: mocks.settings }) }));
vi.mock("../services/desktopNotifications", () => ({ useDesktopAlerts: mocks.desktop }));
vi.mock("../services/alertSound", () => ({
  soundReady: () => true, enableSound: async () => true,
  playAlertSound: mocks.play, stopSound: mocks.stop,
}));
const operator = makeOperator({ role: "POLICE" });
const view = () => <MemoryRouter><AlertAttention operator={operator} /></MemoryRouter>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.live.alerts.data = [makeAlert()];
  mocks.live.incidents.data = [];
  mocks.settings = { desktopNotifications: false, sound: true, volume: 0.8, repeat: true };
});
afterEach(() => vi.useRealTimers());

it("repeats pending alerts, silences existing ones and sounds for a new alert", () => {
  const { rerender } = render(view());
  expect(mocks.play).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(8_000));
  expect(mocks.play).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Silence these alerts" }));
  act(() => vi.advanceTimersByTime(16_000));
  expect(mocks.play).toHaveBeenCalledTimes(2);
  mocks.live.alerts.data = [makeAlert(), makeAlert({ id: 2 })];
  rerender(view());
  expect(mocks.play).toHaveBeenCalledTimes(3);
});

it("stops repeating after acceptance and does not replay unchanged polls", () => {
  const { rerender } = render(view());
  mocks.live.alerts.data = [makeAlert()];
  rerender(view());
  expect(mocks.play).toHaveBeenCalledTimes(1);
  mocks.live.alerts.data = [makeAlert({ status: "ACCEPTED", canAccept: false })];
  rerender(view());
  act(() => vi.advanceTimersByTime(16_000));
  expect(mocks.play).toHaveBeenCalledTimes(1);
  expect(mocks.stop).toHaveBeenCalled();
});

it("honors mute and nonrepeating preferences", () => {
  mocks.settings.sound = false;
  const { rerender } = render(view());
  expect(mocks.play).not.toHaveBeenCalled();
  mocks.settings = { desktopNotifications: false, sound: true, volume: 0.3, repeat: false };
  rerender(view());
  act(() => vi.advanceTimersByTime(16_000));
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith(0.3);
});

it("sends an assignment to the desktop even if its review already opened", () => {
  mocks.settings.desktopNotifications = true;
  mocks.live.incidents.data = [makeIncident({ status: "UNDER_REVIEW", canEdit: true })];
  render(<MemoryRouter><AlertAttention operator={makeOperator({ role: "ADMIN" })} /></MemoryRouter>);
  expect(mocks.desktop).toHaveBeenLastCalledWith(1, true, [expect.objectContaining({
    title: "SafeRoad — Incident assigned to you", path: "/admin?incident=1",
  })], expect.any(Function));
});

it("sends only service-relevant pending alerts to the desktop", () => {
  mocks.settings.desktopNotifications = true;
  mocks.live.alerts.data = [makeAlert(), makeAlert({ id: 2, status: "ACCEPTED", canAccept: false })];
  render(view());
  expect(mocks.desktop).toHaveBeenLastCalledWith(1, true, [expect.objectContaining({
    title: "SafeRoad — New emergency alert", path: "/operator?incident=1",
  })], expect.any(Function));
});
