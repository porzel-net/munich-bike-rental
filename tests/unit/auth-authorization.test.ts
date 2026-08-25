import { describe, expect, it } from "vitest";

import {
  canAccessAdmin,
  canAccessLocation,
  canUseAdminApi,
  canUseAdminApiAsAdmin,
  canUseExternalCalendar,
  getAssignedLocation,
  getVisibleLocationScope,
  hasCompletedAdminSetup,
  isAccountBlocked,
} from "../../lib/auth/authorization";

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

  it("scopes aggregate views to the assigned location", () => {
    expect(getVisibleLocationScope({ role: "standortuser", locationKey: "regensburg" })).toBe("regensburg");
    expect(getVisibleLocationScope({ role: "standortuser", locationKey: "unknown" })).toBeNull();
    expect(getVisibleLocationScope({ role: "admin", locationKey: "regensburg" })).toBeNull();
  });

  it("rejects a Standortuser without a valid assignment", () => {
    expect(canAccessAdmin({ role: "standortuser", locationKey: null })).toBe(false);
    expect(canAccessAdmin({ role: "standortuser", locationKey: "unknown" })).toBe(false);
  });

  it("rejects malformed multi-role values instead of granting the strongest role", () => {
    expect(canAccessAdmin({ role: "standortuser,admin", locationKey: "munich" })).toBe(false);
  });

  it("requires completed setup before allowing direct admin API access", () => {
    const admin = { role: "admin", locationKey: null, twoFactorEnabled: true, mustChangePassword: false };

    expect(hasCompletedAdminSetup(admin)).toBe(true);
    expect(canUseAdminApi(admin)).toBe(true);
    expect(canUseAdminApiAsAdmin(admin)).toBe(true);
    expect(canUseAdminApi({ ...admin, twoFactorEnabled: false })).toBe(false);
    expect(canUseAdminApi({ ...admin, mustChangePassword: true })).toBe(false);
  });

  it("keeps completed Standortuser sessions location-scoped", () => {
    const user = { role: "standortuser", locationKey: "regensburg", twoFactorEnabled: true };

    expect(canUseAdminApi(user)).toBe(true);
    expect(canUseAdminApiAsAdmin(user)).toBe(false);
  });

  it("invalidates an otherwise valid session after a ban or active temporary ban", () => {
    const admin = { role: "admin", twoFactorEnabled: true, mustChangePassword: false };
    expect(isAccountBlocked(admin)).toBe(false);
    expect(isAccountBlocked({ ...admin, banned: true })).toBe(true);
    expect(isAccountBlocked({ ...admin, banExpires: new Date("2030-01-01T00:00:00Z") }, Date.parse("2029-01-01"))).toBe(
      true,
    );
    expect(isAccountBlocked({ ...admin, banExpires: new Date("2028-01-01T00:00:00Z") }, Date.parse("2029-01-01"))).toBe(
      false,
    );
    expect(canUseAdminApi({ ...admin, banned: true })).toBe(false);
    expect(canUseAdminApi({ ...admin, banExpires: new Date("2030-01-01T00:00:00Z") })).toBe(false);
  });

  it("uses the same completed-setup and current-ban rules for external calendars", () => {
    const admin = { role: "admin", twoFactorEnabled: true, mustChangePassword: false };
    expect(canUseExternalCalendar(admin)).toBe(true);
    expect(canUseExternalCalendar({ ...admin, banExpires: new Date("2030-01-01T00:00:00Z") })).toBe(false);
    expect(canUseExternalCalendar({ ...admin, banExpires: new Date("2020-01-01T00:00:00Z") })).toBe(true);
    expect(canUseExternalCalendar({ ...admin, twoFactorEnabled: false })).toBe(false);
  });
});
