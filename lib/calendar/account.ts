import { createHash } from "node:crypto";

/** Stable, non-PII username for the calendar's read-only Basic Auth account. */
export function calendarUsername(userId: string) {
  return `mbr-cal-${createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 24)}`;
}
