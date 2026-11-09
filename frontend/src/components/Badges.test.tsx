import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INCIDENT_STATUS_LABELS } from "../labels";
import { IncidentStatusBadge, SeverityBadge } from "./Badges";

describe("badges", () => {
  it("states severity in words, not only in colour", () => {
    render(<SeverityBadge severity="HIGH" />);
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText(/severity/)).toBeTruthy(); // "High severity" for screen readers
  });

  it("uses friendly labels for workflow codes", () => {
    expect(INCIDENT_STATUS_LABELS.WAITING_FOR_OPERATOR).toBe("Waiting for review");
    expect(INCIDENT_STATUS_LABELS.UNDER_REVIEW).toBe("Being reviewed");
    expect(INCIDENT_STATUS_LABELS.DECLINED).toBe("Rejected / False alarm");
    expect(INCIDENT_STATUS_LABELS.ALERT_SENT).toBe("Alert sent");
    render(<IncidentStatusBadge status="WAITING_FOR_OPERATOR" />);
    expect(screen.getByText("Waiting for review").getAttribute("title")).toMatch(/next available operator automatically/);
  });
});
