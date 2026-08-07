import { describe, expect, it } from "vitest";

import { fixedAssetDepreciationSchedule, monthlyDepreciationCents } from "../../lib/financial/fixed-assets";

describe("fixed asset depreciation", () => {
  const asset = {
    acquisitionCostCents: 100_000,
    residualValueCents: 0,
    usefulLifeMonths: 84,
    inServiceDate: "2026-08-15",
  };

  it("spreads the full depreciable amount across the useful life", () => {
    const schedule = fixedAssetDepreciationSchedule(asset);
    expect(schedule).toHaveLength(84);
    expect(schedule[0]).toMatchObject({ periodStart: "2026-08-01", amountCents: 1_190 });
    expect(schedule.at(-1)?.amountCents).toBe(1_230);
    expect(schedule.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(100_000);
  });

  it("does not depreciate outside the schedule", () => {
    expect(monthlyDepreciationCents(asset, "2026-07-01")).toBe(0);
    expect(monthlyDepreciationCents(asset, "2033-08-01")).toBe(0);
  });
});
