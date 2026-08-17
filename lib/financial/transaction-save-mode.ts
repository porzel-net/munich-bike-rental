export type BankTransactionSaveMode = "post" | "document_only";

export function getBankTransactionSaveMode(input: {
  status: string;
  categoryId: number | null;
  euerTreatment: string | null;
  bookingId?: number | null;
}): BankTransactionSaveMode {
  if (
    input.status === "posted" &&
    input.categoryId !== null &&
    input.euerTreatment &&
    input.euerTreatment !== "needs_review" &&
    !input.bookingId
  ) {
    return "document_only";
  }
  return "post";
}
