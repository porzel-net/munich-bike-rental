import { describe, expect, it } from "vitest";

import { getBankTransactionSaveMode } from "../../lib/financial/transaction-save-mode";

describe("financial bank transaction save mode", () => {
  it("uses document-only mode for a posted transaction with a resolved category", () => {
    expect(getBankTransactionSaveMode({ status: "posted", categoryId: 7, euerTreatment: "expense" })).toBe(
      "document_only",
    );
  });

  it.each([
    { status: "posted", categoryId: 7, euerTreatment: "needs_review" },
    { status: "posted", categoryId: null, euerTreatment: null },
    { status: "needs_review", categoryId: 7, euerTreatment: "expense" },
  ])("keeps the posting flow for an incomplete or unposted transaction: %s", (state) => {
    expect(getBankTransactionSaveMode(state)).toBe("post");
  });
});
