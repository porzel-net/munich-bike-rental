import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeBoundedRateLimit,
  consumePublicOfferRequestRateLimit,
  consumePublicOfferRateLimit,
  resetRateLimitsForTests,
} from "../../lib/security/rate-limit";

describe("bounded public rate limits", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("rejects requests after the configured burst and resets after the window", () => {
    expect(consumeBoundedRateLimit("test", 2, 1_000, 0)).toBe(true);
    expect(consumeBoundedRateLimit("test", 2, 1_000, 10)).toBe(true);
    expect(consumeBoundedRateLimit("test", 2, 1_000, 20)).toBe(false);
    expect(consumeBoundedRateLimit("test", 2, 1_000, 1_000)).toBe(true);
  });

  it("does not keep the raw offer token in the limiter key", () => {
    expect(consumePublicOfferRateLimit("checkout", "opaque-token", { max: 1, windowMs: 1_000 }, 0)).toBe(true);
    expect(consumePublicOfferRateLimit("checkout", "opaque-token", { max: 1, windowMs: 1_000 }, 1)).toBe(false);
    expect(consumePublicOfferRateLimit("checkout", "other-token", { max: 1, windowMs: 1_000 }, 1)).toBe(true);
  });

  it("also limits token spraying from one client address", () => {
    const request = (ip: string) => new Request("http://localhost/api/offer", { headers: { "x-real-ip": ip } });
    for (let index = 0; index < 20; index += 1) {
      expect(
        consumePublicOfferRequestRateLimit(
          request("198.51.100.5"),
          "checkout",
          `token-${index}`,
          {
            max: 1,
            windowMs: 1_000,
          },
          0,
        ),
      ).toBe(true);
    }
    expect(
      consumePublicOfferRequestRateLimit(
        request("198.51.100.5"),
        "checkout",
        "token-20",
        {
          max: 1,
          windowMs: 1_000,
        },
        0,
      ),
    ).toBe(false);
  });
});
