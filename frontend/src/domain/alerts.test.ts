import { describe, expect, it } from "vitest";

import { makeAlert } from "../test/fixtures";
import { matchesAlertFilter, parseAlertFilter, sortAlerts } from "./alerts";

const me = { displayName: "Police 1" };

describe("service operator queue", () => {
  const running = makeAlert({ id: 1, status: "EN_ROUTE", canUpdate: true, canAccept: false, assignedOperator: "Police 1", sentAt: "2026-10-20T08:00:00Z" });
  const newLow = makeAlert({ id: 2, severity: "LOW", sentAt: "2026-10-20T09:00:00Z" });
  const newHigh = makeAlert({ id: 3, severity: "HIGH", sentAt: "2026-10-20T09:30:00Z" });
  const takenByOther = makeAlert({ id: 4, status: "ACCEPTED", canAccept: false, assignedOperator: "Police 2", sentAt: "2026-10-20T09:40:00Z" });

  it("shows my running intervention first, then new alerts by severity", () => {
    expect(sortAlerts([newLow, takenByOther, newHigh, running]).map((a) => a.id)).toEqual([1, 3, 2, 4]);
  });

  it("filters new, mine and all", () => {
    const all = [running, newLow, newHigh, takenByOther];
    expect(all.filter((a) => matchesAlertFilter(a, "new", me)).map((a) => a.id)).toEqual([2, 3]);
    expect(all.filter((a) => matchesAlertFilter(a, "mine", me)).map((a) => a.id)).toEqual([1]);
    expect(all.filter((a) => matchesAlertFilter(a, "all", me))).toHaveLength(4);
  });

  it("reads the filter from the address bar, ignoring anything else", () => {
    expect(parseAlertFilter("mine")).toBe("mine");
    expect(parseAlertFilter("bogus")).toBeNull();
    expect(parseAlertFilter(null)).toBeNull();
  });
});
