import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeks,
  getCalendarMonthKey,
  getCalendarMonthName,
  getCalendarYearLabel,
  parseCalendarMonthKey,
} from "../../lib/calendar/admin-calendar";

describe("admin calendar business timezone", () => {
  it("derives month navigation from Europe/Berlin", () => {
    const instant = new Date("2026-01-31T23:30:00.000Z");
    expect(getCalendarMonthKey(instant)).toBe("2026-02");
    expect(getCalendarMonthName(instant)).toBe("Februar");
    expect(getCalendarYearLabel(instant)).toBe("2026");
  });

  it("keeps date-only grid cells stable regardless of browser timezone", () => {
    const month = parseCalendarMonthKey("2026-02");
    const grid = buildCalendarWeeks([], month, new Date("2026-02-15T23:30:00.000Z"));
    expect(grid.weeks[0]?.days[0]?.date.getUTCDate()).toBe(26);
    expect(grid.weeks.at(-1)?.days.at(-1)?.date.getUTCDate()).toBe(1);
  });
});
