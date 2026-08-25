import { describe, expect, it } from "vitest";

import { hasValidInternalBearerToken } from "../../lib/auth/internal-token";

const expected = "0123456789abcdef0123456789abcdef";

function request(authorization?: string) {
  return new Request("http://localhost/api/internal/job", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("internal bearer tokens", () => {
  it("accepts the exact configured token", () => {
    expect(hasValidInternalBearerToken(request(`Bearer ${expected}`), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(true);
  });

  it("rejects missing, short, malformed, and wrong tokens", () => {
    expect(hasValidInternalBearerToken(request(), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(false);
    expect(hasValidInternalBearerToken(request("Bearer short"), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(false);
    expect(hasValidInternalBearerToken(request(`Basic ${expected}`), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(false);
    expect(
      hasValidInternalBearerToken(request(`Bearer ${expected.slice(0, -1)}x`), { JOB_TOKEN: expected }, "JOB_TOKEN"),
    ).toBe(false);
    expect(hasValidInternalBearerToken(request(`bearer ${expected}`), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(
      false,
    );
    expect(hasValidInternalBearerToken(request(`Bearer  ${expected}`), { JOB_TOKEN: expected }, "JOB_TOKEN")).toBe(
      false,
    );
  });

  it("fails closed for missing or weak deployment configuration", () => {
    expect(hasValidInternalBearerToken(request(`Bearer ${expected}`), {}, "JOB_TOKEN")).toBe(false);
    expect(hasValidInternalBearerToken(request("Bearer short"), { JOB_TOKEN: "short" }, "JOB_TOKEN")).toBe(false);
  });
});
