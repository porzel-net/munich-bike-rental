import { describe, expect, it } from "vitest";

import { getFinancialReviewState } from "../../lib/financial/review-status";

const completeIncome = {
  status: "posted",
  categoryId: 1,
  categoryCode: "travel",
  categoryType: "expense",
  euerTreatment: "expense",
  allocationKind: "expense",
  bookingId: null,
  destinationAccountId: null,
  fixedAssetId: null,
};

describe("getFinancialReviewState", () => {
  it("requires an actual booking assignment for rental revenue", () => {
    expect(
      getFinancialReviewState({
        ...completeIncome,
        categoryCode: "rental_revenue",
        categoryType: "income",
        euerTreatment: "income",
        allocationKind: "revenue",
      }),
    ).toEqual({ status: "needs_review", missing: ["booking"] });
  });

  it("does not treat a recognized reference as a booking assignment", () => {
    expect(
      getFinancialReviewState({
        ...completeIncome,
        categoryCode: "rental_revenue",
        categoryType: "income",
        euerTreatment: "income",
        allocationKind: "booking_payment",
        bookingId: null,
      }).status,
    ).toBe("needs_review");
  });

  it("accepts a complete booking payment", () => {
    expect(
      getFinancialReviewState({
        ...completeIncome,
        categoryCode: "rental_revenue",
        categoryType: "income",
        euerTreatment: "income",
        allocationKind: "booking_payment",
        bookingId: 42,
      }),
    ).toEqual({ status: "posted", missing: [] });
  });

  it("requires a destination account for internal transfers", () => {
    expect(
      getFinancialReviewState({
        ...completeIncome,
        categoryCode: "internal_transfer",
        categoryType: "transfer",
        euerTreatment: "transfer",
        allocationKind: "transfer",
      }),
    ).toEqual({ status: "needs_review", missing: ["destination_account"] });
  });

  it("keeps ignored transactions out of review", () => {
    expect(getFinancialReviewState({ ...completeIncome, status: "ignored" })).toEqual({
      status: "ignored",
      missing: [],
    });
  });
});
