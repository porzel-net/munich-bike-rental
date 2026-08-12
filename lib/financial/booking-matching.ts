/** Returns digit-only order-number candidates found in a bank reference. */
export function extractOrderNumberCandidates(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  return [...new Set(text.match(/\b\d{12,14}\b/g) ?? [])];
}

export function findBookingOrderNumber(
  values: Array<string | null | undefined>,
  bookings: Array<{ id: number; orderNumber: string }>,
) {
  const candidates = new Set(extractOrderNumberCandidates(...values));
  return bookings.find((booking) => candidates.has(booking.orderNumber.replace(/\D/g, ""))) ?? null;
}
