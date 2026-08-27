import type { bookings } from "../db/schema";

type Booking = typeof bookings.$inferSelect;

export function isHistoricalBooking(booking: Booking) {
  return booking.source === "manual" || booking.source === "legacy";
}

/**
 * Manual and bank payments are deliberately allocation-based: a single
 * booking may receive several transfers, including historical corrections.
 * Stripe is handled by a separate full-payment flow and never uses this rule.
 */
export function validateManualBookingPayment(input: {
  booking: Booking;
  amountCents: number;
  receivedCents: number;
  openCents: number;
  hasCharge: boolean;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error("Der Zahlungseingang muss ein positiver Centbetrag sein.");

  if (isHistoricalBooking(input.booking)) {
    return { historicalCorrection: input.amountCents > Math.max(0, input.openCents) || input.openCents <= 0 };
  }

  if (input.hasCharge && input.openCents <= 0)
    throw new Error("Diese Buchung ist bereits vollständig bezahlt.");
  if (
    !input.hasCharge &&
    input.booking.quotedTotalCents > 0 &&
    input.receivedCents + input.amountCents > input.booking.quotedTotalCents
  )
    throw new Error("Die Zahlung darf den bekannten Gesamtpreis der Buchung nicht überschreiten.");
  if (input.hasCharge && input.amountCents > input.openCents)
    throw new Error("Der Zahlungseingang ist höher als der noch offene Buchungsbetrag.");

  return { historicalCorrection: false };
}
