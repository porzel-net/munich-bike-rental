import { describe, expect, it } from "vitest";

import {
  addDateOnlyDays,
  addDateOnlyMonths,
  berlinDateKey,
  berlinYear,
  dateOnlyToLocalDate,
  formatDateOnly,
  formatDateTime,
} from "../../lib/datetime";

describe("business timezone formatting", () => {
  it("keeps date-only values on the Berlin calendar date", () => {
    expect(formatDateOnly("2026-01-01")).toBe("01.01.2026");
    expect(formatDateOnly("2026-01-01T23:59:00.000Z")).toBe("01.01.2026");
  });

  it("formats instants in Europe/Berlin", () => {
    expect(formatDateTime(new Date("2026-01-01T23:30:00.000Z"))).toContain("02.01.2026");
  });

  it("uses the Berlin date for date-only defaults around midnight", () => {
    expect(berlinDateKey(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
    expect(berlinDateKey(new Date("2026-01-01T22:30:00.000Z"))).toBe("2026-01-01");
  });

  it("performs date-only arithmetic without using the machine timezone", () => {
    expect(addDateOnlyDays("2026-01-01", -7)).toBe("2025-12-25");
    expect(addDateOnlyMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addDateOnlyMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("derives the business year from Berlin at the year boundary", () => {
    expect(berlinYear(new Date("2025-12-31T23:30:00.000Z"))).toBe(2026);
  });

  it("creates stable picker dates from Berlin date-only values", () => {
    expect(berlinDateKey(dateOnlyToLocalDate("2026-07-01"))).toBe("2026-07-01");
  });
});
