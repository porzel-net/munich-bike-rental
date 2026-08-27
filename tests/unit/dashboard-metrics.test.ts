import { describe, expect, it } from "vitest";

import { allocateAmountByMonthCents } from "../../lib/dashboard/metrics";

describe("dashboard revenue allocation", () => {
  it("allocates a booking across months by rental days and preserves the total", () => {
    const allocation = allocateAmountByMonthCents(1_000, "2026-01-30", "2026-02-02", 2026);

    expect(allocation).toEqual([500, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(allocation.reduce((total, amount) => total + amount, 0)).toBe(1_000);
  });

  it("only allocates the days that fall within the requested year", () => {
    const allocation = allocateAmountByMonthCents(1_000, "2025-12-30", "2026-01-02", 2026);

    expect(allocation).toEqual([500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
