import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../services/api";
import { makeIncident, makeOperator } from "../../test/fixtures";
import type { Incident, ServiceType } from "../../types/api";
import { DecisionPanel } from "./DecisionPanel";

const api = vi.hoisted(() => ({
  confirm: vi.fn(),
  decline: vi.fn(),
  saveDraft: vi.fn(),
  sendAlert: vi.fn(),
}));

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return { ...actual, api };
});

function renderPanel(incident: Incident, selected: ServiceType[] = incident.selectedServices) {
  const onChanged = vi.fn();
  render(
    <DecisionPanel
      incident={incident}
      viewer={makeOperator({ currentIncidentId: incident.id, status: "BUSY" })}
      selected={selected}
      onSelect={vi.fn()}
      nearby={{}}
      chosen={{}}
      onChooseStation={vi.fn()}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("decision panel", () => {
  it("asks to verify first and never offers dispatch on an unconfirmed incident", async () => {
    api.confirm.mockResolvedValue(makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" }));
    const { onChanged } = renderPanel(makeIncident({ confirmedAt: null }));

    expect(screen.getByRole("button", { name: /confirm accident/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /false alarm/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dispatch/i })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /confirm accident/i }));
    expect(api.confirm).toHaveBeenCalledWith(1);
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByText(/confirmed as a real accident/i)).toBeTruthy();
    expect(api.sendAlert).not.toHaveBeenCalled();
  });

  it("sends the alert only after the confirmation dialog, which names the incident and services", async () => {
    api.sendAlert.mockResolvedValue(makeIncident({ status: "ALERT_SENT" }));
    renderPanel(makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" }));

    await userEvent.click(screen.getByRole("button", { name: /send alert…/i }));
    expect(api.sendAlert).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("INC-1001")).toBeTruthy();
    expect(within(dialog).getByText("Police")).toBeTruthy();
    expect(within(dialog).getByText("Ambulance (SAMU)")).toBeTruthy();
    expect(within(dialog).queryByText(/simulat/i)).toBeNull();
    // Focus starts on Cancel: a reflex Enter does not send.
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));

    await userEvent.click(within(dialog).getByRole("button", { name: /^send alert$/i }));
    expect(api.sendAlert).toHaveBeenCalledWith(1, ["POLICE", "AMBULANCE"], {});
    expect(await screen.findByText(/alert sent to police, ambulance \(samu\)/i)).toBeTruthy();
  });

  it("cannot dispatch with no service selected", () => {
    renderPanel(makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" }), []);
    expect((screen.getByRole("button", { name: /send alert…/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/select at least one service/i)).toBeTruthy();
  });

  it("rejects a false alarm only after a warning dialog", async () => {
    api.decline.mockResolvedValue(makeIncident({ status: "DECLINED" }));
    renderPanel(makeIncident());
    await userEvent.click(screen.getByRole("button", { name: /false alarm/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/no service will be alerted/i)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: /reject as false alarm/i }));
    expect(api.decline).toHaveBeenCalledWith(1);
  });

  it("explains a conflict with another operator and refreshes instead of overwriting", async () => {
    api.sendAlert.mockRejectedValue(new ApiError(409, "INCIDENT_ALREADY_ASSIGNED", "taken"));
    const { onChanged } = renderPanel(makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" }));
    await userEvent.click(screen.getByRole("button", { name: /send alert…/i }));
    await userEvent.click(screen.getByRole("button", { name: /^send alert$/i }));

    expect(await screen.findByText(/already being reviewed by another operator/i)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByText(/alert sent to/i)).toBeNull();
  });

  it("never reports success when the server did not answer", async () => {
    api.sendAlert.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Cannot reach the server."));
    renderPanel(makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" }));
    await userEvent.click(screen.getByRole("button", { name: /send alert…/i }));
    await userEvent.click(screen.getByRole("button", { name: /^send alert$/i }));
    expect(await screen.findByText(/alert not confirmed — the server did not answer/i)).toBeTruthy();
    expect(screen.queryByText(/alert sent to/i)).toBeNull();
  });

  it("is read only when another admin holds the incident", () => {
    renderPanel(makeIncident({ canEdit: false, assignedAdmin: "Admin 2" }));
    expect(screen.getByText(/currently handled by admin 2/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /confirm accident/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /false alarm/i })).toBeNull();
  });
});
