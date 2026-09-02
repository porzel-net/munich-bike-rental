import { describe, expect, it } from "vitest";

import { requiresFinancialDocument } from "../../lib/financial/receipt-requirements";

describe("financial receipt requirements", () => {
  it("requires receipts for all operating expense categories", () => {
    expect(requiresFinancialDocument({ categoryType: "expense", euerLine: "repairs" })).toBe(true);
    expect(requiresFinancialDocument({ categoryType: "fee", euerLine: "other_operating_expense" })).toBe(true);
    expect(requiresFinancialDocument({ categoryType: "expense", euerLine: "asset_acquisition" })).toBe(true);
  });

  it("does not require receipts for wages or depreciation", () => {
    expect(requiresFinancialDocument({ categoryType: "expense", euerLine: "wages" })).toBe(false);
    expect(requiresFinancialDocument({ categoryType: "expense", euerLine: "depreciation" })).toBe(false);
  });

  it("does not require receipts for non-expense categories", () => {
    expect(requiresFinancialDocument({ categoryType: "income", euerLine: "rental_income" })).toBe(false);
    expect(requiresFinancialDocument({ categoryType: "tax", euerLine: "vat" })).toBe(false);
  });
});
