import { describe, expect, it } from "vitest";

import { makeIncident } from "../test/fixtures";
import {
  aiPrediction,
  incidentTitle,
  injuryFlagReason,
  matchesQueueFilter,
  matchesSearch,
  reviewActions,
  reviewStage,
  severityExplanation,
  sortQueue,
} from "./incidents";

const me = { displayName: "Admin 1" };

describe("incident wording", () => {
  it("calls an unconfirmed detection a possibility", () => {
    expect(incidentTitle(makeIncident({ vehicles: 3 }))).toBe("Possible collision · 3 vehicles");
    expect(incidentTitle(makeIncident({ fire: true }))).toBe("Possible accident with a vehicle fire");
  });

  it("drops 'Possible' once an admin confirmed it, but the AI prediction stays a possibility", () => {
    const confirmed = makeIncident({ confirmedAt: "2026-10-20T10:02:00Z" });
    expect(incidentTitle(confirmed)).toBe("Collision · 3 vehicles");
    expect(aiPrediction(confirmed)).toBe("Possible collision · 3 vehicles");
  });

  it("explains the injury flag from what was seen, and nothing else", () => {
    expect(injuryFlagReason(makeIncident({ people: 1 }))).toBe("A person is visible.");
    expect(injuryFlagReason(makeIncident({ people: 0, overturned: true }))).toBe("A vehicle is overturned.");
    expect(injuryFlagReason(makeIncident({ people: 0, fire: false, overturned: false }))).toBeNull();
  });
});

describe("severity explanation mirrors ai/severity.py", () => {
  it.each([
    [{ vehicles: 3, people: 0, fire: false, overturned: false, severity: "HIGH" as const }, "High: the AI saw 3 vehicles."],
    [{ vehicles: 1, people: 0, fire: true, overturned: false, severity: "HIGH" as const }, "High: the AI saw a vehicle fire."],
    [{ vehicles: 2, people: 1, fire: false, overturned: false, severity: "MEDIUM" as const }, "Medium: the AI saw 2 vehicles and 1 person."],
    [{ vehicles: 1, people: 0, fire: false, overturned: false, severity: "LOW" as const }, "Low: the AI saw one vehicle and no people."],
  ])("%o", (counts, expected) => {
    expect(severityExplanation(counts)).toBe(expected);
  });

  it("says nothing when the stored severity came from another rule", () => {
    expect(severityExplanation({ vehicles: 1, people: 0, fire: false, overturned: false, severity: "HIGH" })).toBeNull();
  });
});

describe("queue", () => {
  const waitingLow = makeIncident({ id: 1, severity: "LOW", status: "WAITING_FOR_OPERATOR", canEdit: false, assignedAdmin: null, detectedAt: "2026-10-20T09:00:00Z" });
  const waitingHigh = makeIncident({ id: 2, severity: "HIGH", status: "WAITING_FOR_OPERATOR", canEdit: false, assignedAdmin: null, detectedAt: "2026-10-20T09:30:00Z" });
  const olderHigh = makeIncident({ id: 3, severity: "HIGH", status: "WAITING_FOR_OPERATOR", canEdit: false, assignedAdmin: null, detectedAt: "2026-10-20T09:10:00Z" });
  const mine = makeIncident({ id: 4, severity: "LOW", status: "UNDER_REVIEW", canEdit: true, detectedAt: "2026-10-20T09:50:00Z" });
  const dispatched = makeIncident({ id: 5, severity: "HIGH", status: "ALERT_SENT", canEdit: false, assignedAdmin: "Admin 2", detectedAt: "2026-10-20T08:00:00Z" });
  const all = [waitingLow, waitingHigh, olderHigh, mine, dispatched];

  it("puts my incident first, then undecided ones by severity and waiting time", () => {
    expect(sortQueue(all, "priority").map((i) => i.id)).toEqual([4, 3, 2, 1, 5]);
  });

  it("can show the real chronological order, newest first", () => {
    expect(sortQueue(all, "newest").map((i) => i.id)).toEqual([4, 2, 3, 1, 5]);
  });

  it("filters: waiting, mine, high", () => {
    expect(all.filter((i) => matchesQueueFilter(i, "waiting", me)).map((i) => i.id)).toEqual([1, 2, 3]);
    expect(all.filter((i) => matchesQueueFilter(i, "mine", me)).map((i) => i.id)).toEqual([4]);
    expect(all.filter((i) => matchesQueueFilter(i, "high", me)).map((i) => i.id)).toEqual([2, 3, 5]);
  });

  it("searches by reference, location, camera and operator", () => {
    expect(matchesSearch(makeIncident({ id: 7 }), "inc-1007")).toBe(true);
    expect(matchesSearch(makeIncident({ location: "Périphérique" }), "périph")).toBe(true);
    expect(matchesSearch(makeIncident({ assignedAdmin: "Claire" }), "claire")).toBe(true);
    expect(matchesSearch(makeIncident(), "nothing like this")).toBe(false);
  });
});

describe("review stage and valid actions", () => {
  it("my unconfirmed incident: confirm or reject, never dispatch", () => {
    const stage = reviewStage(makeIncident({ canEdit: true, confirmedAt: null }));
    expect(stage).toEqual({ kind: "verify" });
    expect(reviewActions(stage)).toEqual(["confirm", "reject"]);
  });

  it("my confirmed incident: dispatch, save or reject", () => {
    const stage = reviewStage(makeIncident({ canEdit: true, confirmedAt: "2026-10-20T10:02:00Z" }));
    expect(stage).toEqual({ kind: "dispatch" });
    expect(reviewActions(stage)).toContain("dispatch");
  });

  it("someone else's incident is read only, with no action", () => {
    const stage = reviewStage(makeIncident({ canEdit: false, assignedAdmin: "Admin 2" }));
    expect(stage).toEqual({ kind: "readOnly", by: "Admin 2" });
    expect(reviewActions(stage)).toEqual([]);
  });

  it("waiting and decided incidents offer nothing to do", () => {
    expect(reviewStage(makeIncident({ status: "WAITING_FOR_OPERATOR", canEdit: false, assignedAdmin: null }))).toEqual({ kind: "waiting" });
    for (const status of ["ALERT_SENT", "DECLINED", "IN_PROGRESS", "RESOLVED"] as const) {
      expect(reviewActions(reviewStage(makeIncident({ status, canEdit: false })))).toEqual([]);
    }
  });
});
