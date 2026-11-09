import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./Dialog";
import { DataView, ErrorState } from "./ui";

describe("confirmation dialog", () => {
  it("is labelled, starts on Cancel and closes with Escape", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Send the alert?" confirmLabel="Send" onConfirm={vi.fn()} onCancel={onCancel}>
        <p>Body</p>
      </ConfirmDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Send the alert?" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent(dialog, new Event("cancel", { cancelable: true })); // what the browser fires on Escape
    expect(onCancel).toHaveBeenCalled();
  });

  it("cannot be closed or confirmed twice while the request runs", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Send?" confirmLabel="Send" busyLabel="Sending…" busy onConfirm={onConfirm} onCancel={onCancel}>
        <p>Body</p>
      </ConfirmDialog>,
    );
    const send = screen.getByRole("button", { name: /sending/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await userEvent.click(send);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("data states", () => {
  it("offers a retry on errors", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Cannot reach the server." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("keeps showing loaded data, flagged as possibly outdated, when a refresh fails", () => {
    render(
      <DataView data={["row"]} error="Cannot reach the server." onRetry={vi.fn()}>
        {(rows) => <p>{rows.join()}</p>}
      </DataView>,
    );
    expect(screen.getByText("row")).toBeTruthy();
    expect(screen.getByText(/may be outdated/i)).toBeTruthy();
  });
});
