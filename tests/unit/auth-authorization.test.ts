import { describe, expect, it } from "vitest";

import { canAccessAdmin, canAccessLocation, getAssignedLocation } from "../../lib/auth/authorization";

describe("location-scoped authorization", () => {
  it("grants admins access to every location", () => {
    const admin = { role: "admin", locationKey: null };

    expect(canAccessAdmin(admin)).toBe(true);
    expect(canAccessLocation(admin, "munich")).toBe(true);
    expect(canAccessLocation(admin, "konstanz")).toBe(true);
  });

  it("limits Standortuser to their assigned location", () => {
    const user = { role: "standortuser", locationKey: "regensburg" };

    expect(getAssignedLocation(user)).toBe("regensburg");
    expect(canAccessAdmin(user)).toBe(true);
    expect(canAccessLocation(user, "regensburg")).toBe(true);
    expect(canAccessLocation(user, "munich")).toBe(false);
  });

  it("rejects a Standortuser without a valid assignment", () => {
    expect(canAccessAdmin({ role: "standortuser", locationKey: null })).toBe(false);
    expect(canAccessAdmin({ role: "standortuser", locationKey: "unknown" })).toBe(false);
  });

  it("rejects malformed multi-role values instead of granting the strongest role", () => {
    expect(canAccessAdmin({ role: "standortuser,admin", locationKey: "munich" })).toBe(false);
  });
});
