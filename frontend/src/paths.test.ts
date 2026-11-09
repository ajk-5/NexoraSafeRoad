import { describe, expect, it } from "vitest";

import { serviceOf } from "./labels";
import { areaOf, homePath, workspacePath } from "./paths";

describe("areas per role", () => {
  it("gives the super admin, admins and service operators their own area", () => {
    expect(areaOf("SUPERADMIN")).toBe("superadmin");
    expect(areaOf("ADMIN")).toBe("admin");
    expect(areaOf("POMPIERS")).toBe("operator");
    expect(homePath("SUPERADMIN")).toBe("/superadmin");
  });

  it("opens incidents read only for the super admin, in the dashboard for the others", () => {
    expect(workspacePath("SUPERADMIN", 7)).toBe("/superadmin/incidents/7");
    expect(workspacePath("ADMIN", 7)).toBe("/admin?incident=7");
    expect(workspacePath("POLICE", 7)).toBe("/operator?incident=7");
  });

  it("knows which roles are emergency services", () => {
    expect(serviceOf("AMBULANCE")).toBe("AMBULANCE");
    expect(serviceOf("ADMIN")).toBeNull();
    expect(serviceOf("SUPERADMIN")).toBeNull();
  });
});
