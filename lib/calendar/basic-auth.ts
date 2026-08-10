import { createHash, timingSafeEqual } from "node:crypto";

type CalendarAuthEnvironment = {
  CALENDAR_FEED_USERNAME?: string;
  CALENDAR_FEED_PASSWORD?: string;
};

function constantTimeEqual(actual: string, expected: string) {
  const actualHash = createHash("sha256").update(actual, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function parseBasicAuthorization(value: string | null) {
  if (!value) return null;
  const match = /^Basic\s+([^\s]+)$/i.exec(value.trim());
  if (!match) return null;

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

/** Validates credentials without exposing the configured password to callers. */
export function hasValidCalendarBasicAuth(
  request: Request,
  environment: CalendarAuthEnvironment = {
    CALENDAR_FEED_USERNAME: process.env.CALENDAR_FEED_USERNAME,
    CALENDAR_FEED_PASSWORD: process.env.CALENDAR_FEED_PASSWORD,
  },
) {
  const expectedUsername = environment.CALENDAR_FEED_USERNAME?.trim();
  const expectedPassword = environment.CALENDAR_FEED_PASSWORD;
  if (!expectedUsername || !expectedPassword || expectedPassword.length < 16) return false;

  const credentials = parseBasicAuthorization(request.headers.get("authorization"));
  return Boolean(
    credentials &&
    constantTimeEqual(credentials.username, expectedUsername) &&
    constantTimeEqual(credentials.password, expectedPassword),
  );
}
