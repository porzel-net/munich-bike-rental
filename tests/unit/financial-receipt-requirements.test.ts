import { describe, expect, it } from "vitest";

import { requiresFinancialDocument } from "../../lib/financial/receipt-requirements";

describe("financial receipt requirements", () => {
  it("requires a receipt for spare parts and consumables", () => {
    expect(requiresFinancialDocument("spare_parts_consumables")).toBe(true);
  });

  it("does not require a receipt for unrelated categories", () => {
    expect(requiresFinancialDocument("maintenance")).toBe(false);
  });
});
