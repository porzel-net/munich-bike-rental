import { describe, expect, it } from "vitest";

import { configuredOrigin, hasTrustedOrigin } from "../../lib/auth/request";

describe("trusted request origins", () => {
  const environment = { APP_ORIGIN: "https://admin.example.com" };

  it("accepts exactly the configured origin", () => {
    expect(
      hasTrustedOrigin(
        new Request("https://admin.example.com/api/admin/settings", {
          headers: { Origin: "https://admin.example.com" },
        }),
        environment,
      ),
    ).toBe(true);
    expect(
      hasTrustedOrigin(
        new Request("https://admin.example.com/api/admin/settings", {
          headers: { Origin: "https://attacker.example" },
        }),
        environment,
      ),
    ).toBe(false);
    expect(hasTrustedOrigin(new Request("https://admin.example.com/api/admin/settings"), environment)).toBe(false);
  });

  it("fails closed for malformed configuration", () => {
    expect(configuredOrigin({ BETTER_AUTH_URL: "not-a-url" })).toBeNull();
    expect(
      hasTrustedOrigin(
        new Request("https://admin.example.com/api/admin/settings", {
          headers: { Origin: "https://admin.example.com" },
        }),
        { BETTER_AUTH_URL: "not-a-url" },
      ),
    ).toBe(false);
  });
});
