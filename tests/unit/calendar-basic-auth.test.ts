import { describe, expect, it } from "vitest";

import { hasValidCalendarBasicAuth } from "../../lib/calendar/basic-auth";

const environment = {
  CALENDAR_FEED_USERNAME: "calendar-admin",
  CALENDAR_FEED_PASSWORD: "a-strong-calendar-password",
};

function request(authorization?: string) {
  return new Request("https://example.com/api/calendar/feed.ics", {
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

describe("calendar basic auth", () => {
  it("accepts valid credentials", () => {
    const credentials = Buffer.from("calendar-admin:a-strong-calendar-password").toString("base64");

    expect(hasValidCalendarBasicAuth(request(`Basic ${credentials}`), environment)).toBe(true);
  });

  it("rejects missing and invalid credentials", () => {
    const wrongCredentials = Buffer.from("calendar-admin:wrong-password").toString("base64");

    expect(hasValidCalendarBasicAuth(request(), environment)).toBe(false);
    expect(hasValidCalendarBasicAuth(request(`Basic ${wrongCredentials}`), environment)).toBe(false);
    expect(hasValidCalendarBasicAuth(request("Bearer token"), environment)).toBe(false);
  });

  it("fails closed for weak configured passwords", () => {
    const credentials = Buffer.from("calendar-admin:short").toString("base64");

    expect(
      hasValidCalendarBasicAuth(request(`Basic ${credentials}`), {
        ...environment,
        CALENDAR_FEED_PASSWORD: "short",
      }),
    ).toBe(false);
  });
});
