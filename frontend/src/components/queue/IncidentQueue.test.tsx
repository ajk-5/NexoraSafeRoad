import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { QueueFilter } from "../../domain/incidents";
import { makeIncident } from "../../test/fixtures";
import type { Incident } from "../../types/api";
import { IncidentQueue } from "./IncidentQueue";

const operator = { displayName: "Admin 1", status: "BUSY" as const };

function Harness({ incidents, error = null, onRetry = vi.fn(), selectedId = null }: { incidents: Incident[] | undefined; error?: string | null; onRetry?: () => void; selectedId?: number | null }) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  return (
    <MemoryRouter>
      <IncidentQueue
        incidents={incidents}
        error={error}
        onRetry={onRetry}
        operator={operator}
        selectedId={selectedId}
        filter={filter}
        onFilter={setFilter}
        linkFor={(id) => `?incident=${id}`}
      />
    </MemoryRouter>
  );
}

const incidents = [
  makeIncident({ id: 1, severity: "LOW", status: "WAITING_FOR_OPERATOR", canEdit: false, assignedAdmin: null, location: "Rue de Rivoli" }),
  makeIncident({ id: 2, severity: "HIGH", status: "UNDER_REVIEW", canEdit: true, location: "A7 - KM 32.4" }),
  makeIncident({ id: 3, severity: "MEDIUM", status: "RESOLVED", canEdit: false, location: "Closed one" }),
];

describe("incident queue", () => {
  it("lists open incidents only, most urgent first, and marks the selected one", () => {
    render(<Harness incidents={incidents} selectedId={2} />);
    const items = within(screen.getByRole("list", { name: /incidents/i })).getAllByRole("link");
    expect(items).toHaveLength(2); // the resolved one is history, not queue
    expect(items[0]?.textContent).toContain("A7 - KM 32.4");
    expect(items[0]?.getAttribute("aria-current")).toBe("true");
    expect(items[0]?.getAttribute("href")).toBe("/?incident=2");
    expect(items[0]?.textContent).toMatch(/assigned to you/i);
  });

  it("filters with labelled toggle buttons that show their counts", async () => {
    render(<Harness incidents={incidents} />);
    const waiting = screen.getByRole("button", { name: /waiting/i });
    expect(waiting.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(waiting);
    expect(waiting.getAttribute("aria-pressed")).toBe("true");
    const items = within(screen.getByRole("list", { name: /incidents/i })).getAllByRole("link");
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Rue de Rivoli");
  });

  it("explains an empty filter", async () => {
    render(<Harness incidents={[incidents[0] as Incident]} />);
    await userEvent.click(screen.getByRole("button", { name: /mine/i }));
    expect(screen.getByText(/nothing assigned to you/i)).toBeTruthy();
  });

  it("shows loading, then an error with a working retry", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Harness incidents={undefined} />);
    expect(screen.getByRole("status", { name: /loading incidents/i })).toBeTruthy();
    rerender(<Harness incidents={undefined} error="Cannot reach the server." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("warns that data may be outdated when a refresh fails after a load", () => {
    render(<Harness incidents={incidents} error="Cannot reach the server." />);
    expect(screen.getByText(/this data may be outdated/i)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: /incidents/i })).getAllByRole("link")).toHaveLength(2);
  });

  it("can be searched from the keyboard", async () => {
    render(<Harness incidents={incidents} />);
    await userEvent.click(screen.getByRole("button", { name: /search incidents/i }));
    await userEvent.keyboard("rivoli");
    const items = within(screen.getByRole("list", { name: /incidents/i })).getAllByRole("link");
    expect(items).toHaveLength(1);
  });
});
