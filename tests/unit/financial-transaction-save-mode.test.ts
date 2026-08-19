import { describe, expect, it } from "vitest";

import { getBankTransactionSaveMode } from "../../lib/financial/transaction-save-mode";

describe("financial bank transaction save mode", () => {
  it("uses document-only mode for a posted transaction with a resolved category", () => {
    expect(getBankTransactionSaveMode({ status: "posted", categoryId: 7, euerTreatment: "expense" })).toBe(
      "document_only",
    );
  });

  it("keeps the posting flow when a booking is selected for reconciliation", () => {
    expect(
      getBankTransactionSaveMode({ status: "posted", categoryId: 7, euerTreatment: "income", bookingId: 42 }),
    ).toBe("post");
  });

  it("keeps the posting flow when a posted category is changed", () => {
    expect(
      getBankTransactionSaveMode({
        status: "posted",
        categoryId: 8,
        euerTreatment: "expense",
        originalCategoryId: 7,
        originalBookingId: null,
        originalDestinationAccountId: null,
        destinationAccountId: null,
      }),
    ).toBe("post");
  });

  it("keeps the posting flow when the source account of a manual transaction is changed", () => {
    expect(
      getBankTransactionSaveMode({
        status: "posted",
        categoryId: 7,
        euerTreatment: "expense",
        financialAccountId: 12,
        originalCategoryId: 7,
        originalBookingId: null,
        originalDestinationAccountId: null,
        originalFinancialAccountId: 3,
      }),
    ).toBe("post");
  });

  it.each([
    { status: "posted", categoryId: 7, euerTreatment: "income", bookingId: 42 },
    { status: "posted", categoryId: 7, euerTreatment: "expense", bookingId: 42 },
  ])("keeps the posting flow for a selected booking: %s", (state) => {
    expect(getBankTransactionSaveMode(state)).toBe("post");
  });

  it.each([
    { status: "posted", categoryId: 7, euerTreatment: "needs_review" },
    { status: "posted", categoryId: null, euerTreatment: null },
    { status: "needs_review", categoryId: 7, euerTreatment: "expense" },
  ])("keeps the posting flow for an incomplete or unposted transaction: %s", (state) => {
    expect(getBankTransactionSaveMode(state)).toBe("post");
  });
});
