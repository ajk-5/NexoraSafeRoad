import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeOperator } from "../../test/fixtures";
import { AvailabilityControl } from "./AvailabilityControl";

const api = vi.hoisted(() => ({ pause: vi.fn(), resume: vi.fn(), release: vi.fn(), me: vi.fn() }));

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return { ...actual, api };
});

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe("availability control", () => {
  it("pauses straight away when nothing is in hand", async () => {
    const paused = makeOperator({ status: "PAUSED" });
    api.pause.mockResolvedValue(paused);
    const onUpdate = vi.fn();
    render(<AvailabilityControl operator={makeOperator()} onUpdate={onUpdate} />);
    expect(screen.getByText("Available")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(api.pause).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(paused);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks what happens to the incident in hand, and can keep it", async () => {
    api.pause.mockResolvedValue(makeOperator({ status: "PAUSED", currentIncidentId: 3 }));
    render(<AvailabilityControl operator={makeOperator({ status: "BUSY", currentIncidentId: 3 })} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/pause while handling inc-1003/i)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: /keep it and pause/i }));
    expect(api.pause).toHaveBeenCalledTimes(1);
    expect(api.release).not.toHaveBeenCalled();
  });

  it("returns the incident to the queue only after pausing, so it cannot come straight back", async () => {
    const calls: string[] = [];
    api.pause.mockImplementation(() => {
      calls.push("pause");
      return Promise.resolve(makeOperator({ status: "PAUSED", currentIncidentId: 3 }));
    });
    api.release.mockImplementation(() => {
      calls.push("release");
      return Promise.resolve({});
    });
    api.me.mockResolvedValue(makeOperator({ status: "PAUSED", currentIncidentId: null }));
    const onUpdate = vi.fn();
    render(<AvailabilityControl operator={makeOperator({ status: "BUSY", currentIncidentId: 3 })} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    await userEvent.click(screen.getByRole("button", { name: /return it to the queue/i }));
    expect(calls).toEqual(["pause", "release"]);
    expect(api.release).toHaveBeenCalledWith(3);
    expect(onUpdate).toHaveBeenLastCalledWith(makeOperator({ status: "PAUSED", currentIncidentId: null }));
  });

  it("resumes a paused operator", async () => {
    api.resume.mockResolvedValue(makeOperator({ status: "ACTIVE" }));
    render(<AvailabilityControl operator={makeOperator({ status: "PAUSED" })} onUpdate={vi.fn()} />);
    expect(screen.getByText("Paused")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(api.resume).toHaveBeenCalledTimes(1);
  });
});
