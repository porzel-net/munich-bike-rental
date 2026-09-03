import { requiresFinancialDocument } from "./receipt-requirements";

export type FinancialReviewStatus = "posted" | "needs_review" | "ignored";

export type FinancialReviewCompletenessInput = {
  status: string;
  categoryId: number | null;
  categoryCode: string | null;
  categoryType: string | null;
  euerLine: string | null;
  euerTreatment: string | null;
  allocationKind: string | null;
  bookingId: number | null;
  destinationAccountId: number | null;
  fixedAssetId: number | null;
  documentCount: number;
};

export type FinancialReviewMissingInformation =
  "posting" | "euer_category" | "booking" | "destination_account" | "fixed_asset" | "document";

export function countOpenFinancialReviews(inputs: FinancialReviewCompletenessInput[]) {
  return inputs.filter((input) => getFinancialReviewState(input).status === "needs_review").length;
}

export function getFinancialReviewState(input: FinancialReviewCompletenessInput): {
  status: FinancialReviewStatus;
  missing: FinancialReviewMissingInformation[];
} {
  if (input.status === "ignored") return { status: "ignored", missing: [] };

  const missing: FinancialReviewMissingInformation[] = [];
  if (input.status !== "posted") missing.push("posting");

  const hasEuerCategory =
    input.categoryId !== null && Boolean(input.euerTreatment) && input.euerTreatment !== "needs_review";
  if (!hasEuerCategory) missing.push("euer_category");

  const requiresBooking = input.categoryCode === "rental_revenue" || input.allocationKind === "booking_payment";
  if (requiresBooking && input.bookingId === null) missing.push("booking");

  if (input.categoryType === "transfer" && input.destinationAccountId === null) {
    missing.push("destination_account");
  }

  if (input.allocationKind === "asset_acquisition" && input.fixedAssetId === null) {
    missing.push("fixed_asset");
  }

  if (
    requiresFinancialDocument({ categoryType: input.categoryType, euerLine: input.euerLine }) &&
    input.documentCount === 0
  ) {
    missing.push("document");
  }

  return {
    status: missing.length === 0 ? "posted" : "needs_review",
    missing,
  };
}
