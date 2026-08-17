/** Returns digit-only order-number candidates found in a bank reference. */
export function extractOrderNumberCandidates(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  // Bank references often add protocol data directly before/after the order
  // number (e.g. `20260806080840 /INS/CTBAAU2SXXX`). Do not require a word
  // boundary; only prevent taking a 14-digit slice out of a longer number.
  return [...new Set(text.match(/(?<!\d)\d{12,14}(?!\d)/g) ?? [])];
}

export function findBookingOrderNumber<T extends { id: number; orderNumber: string }>(
  values: Array<string | null | undefined>,
  bookings: T[],
) {
  const candidates = new Set(extractOrderNumberCandidates(...values));
  return bookings.find((booking) => candidates.has(booking.orderNumber.replace(/\D/g, ""))) ?? null;
}
