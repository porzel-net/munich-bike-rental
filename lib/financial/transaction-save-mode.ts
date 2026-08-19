export type BankTransactionSaveMode = "post" | "document_only";

export function getBankTransactionSaveMode(input: {
  status: string;
  categoryId: number | null;
  euerTreatment: string | null;
  bookingId?: number | null;
  destinationAccountId?: number | null;
  originalCategoryId?: number | null;
  originalBookingId?: number | null;
  originalDestinationAccountId?: number | null;
}): BankTransactionSaveMode {
  const hasAccountingChange =
    input.originalCategoryId !== undefined ||
    input.originalBookingId !== undefined ||
    input.originalDestinationAccountId !== undefined
      ? input.categoryId !== input.originalCategoryId ||
        (input.bookingId ?? null) !== (input.originalBookingId ?? null) ||
        (input.destinationAccountId ?? null) !== (input.originalDestinationAccountId ?? null)
      : false;
  if (
    input.status === "posted" &&
    input.categoryId !== null &&
    input.euerTreatment &&
    input.euerTreatment !== "needs_review" &&
    !input.bookingId &&
    !hasAccountingChange
  ) {
    return "document_only";
  }
  return "post";
}
