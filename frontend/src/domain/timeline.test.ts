import { describe, expect, it } from "vitest";

import { makeIncident, makeIncidentAlert } from "../test/fixtures";
import { buildTimeline } from "./timeline";

describe("buildTimeline", () => {
  it("shows a waiting incident as detected, then waiting", () => {
    const events = buildTimeline(makeIncident({ status: "WAITING_FOR_OPERATOR", assignedAdmin: null, canEdit: false }));
    expect(events.map((e) => [e.title, e.at])).toEqual([
      ["Detected by the AI", "2026-10-20T10:00:00Z"],
      ["Waiting for an available admin", null],
    ]);
  });

  it("orders recorded steps by time and names who did them", () => {
    const incident = makeIncident({
      status: "IN_PROGRESS",
      confirmedAt: "2026-10-20T10:02:00Z",
      decidedAt: "2026-10-20T10:04:00Z",
      alerts: [
        makeIncidentAlert({ id: 1, serviceType: "POLICE", status: "EN_ROUTE", assignedOperator: "Police 1", acceptedAt: "2026-10-20T10:06:00Z" }),
        makeIncidentAlert({ id: 2, serviceType: "AMBULANCE", status: "SENT" }),
      ],
    });
    const events = buildTimeline(incident);
    expect(events.map((e) => e.title)).toEqual([
      "Detected by the AI",
      "Confirmed as a real accident",
      "Alert sent",
      "Police accepted",
      "Police: en route",
      "Ambulance: waiting for an operator to accept",
    ]);
    expect(events[1]?.detail).toBe("by Admin 1");
    expect(events[2]?.detail).toBe("To Police, Ambulance · by Admin 1");
    // Steps without a recorded time are never given one.
    expect(events.slice(4).every((e) => e.at === null)).toBe(true);
  });

  it("records a rejection without inventing a dispatch", () => {
    const events = buildTimeline(makeIncident({ status: "DECLINED", decidedAt: "2026-10-20T10:03:00Z", canEdit: false }));
    expect(events.map((e) => e.title)).toEqual(["Detected by the AI", "Rejected as a false alarm"]);
  });
});
