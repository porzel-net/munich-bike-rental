import type { AppDatabase } from "../db/client";
import { stripeUnmatchedPayments } from "../db/schema";
import type { StripeCheckoutSession } from "../stripe";

function paymentIntentId(session: StripeCheckoutSession) {
  return typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
}

function paymentCurrency(session: StripeCheckoutSession) {
  const currency = session.currency?.toUpperCase() ?? "EUR";
  return /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
}

/**
 * Records an already-paid Checkout Session which was deliberately not posted
 * to the ledger because no booking can be verified for it. The Stripe session
 * ID makes repeated webhooks and reconciliation runs safe.
 */
export function recordUnmatchedStripePayment(
  db: AppDatabase,
  session: StripeCheckoutSession,
  reason: string,
  now = new Date(),
) {
  const occurredAt =
    typeof session.created === "number" && Number.isFinite(session.created) && session.created > 0
      ? new Date(session.created * 1_000)
      : now;
  const amountCents =
    typeof session.amount_total === "number" && Number.isSafeInteger(session.amount_total) && session.amount_total > 0
      ? session.amount_total
      : null;
  const offerId = Number(session.metadata?.booking_offer_id);
  const bookingId = Number(session.metadata?.booking_id);

  return db
    .insert(stripeUnmatchedPayments)
    .values({
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId(session),
      amountCents,
      currency: paymentCurrency(session),
      customerEmail: session.customer_email?.trim() || null,
      bookingOfferId: Number.isSafeInteger(offerId) && offerId > 0 ? offerId : null,
      bookingId: Number.isSafeInteger(bookingId) && bookingId > 0 ? bookingId : null,
      reason,
      occurredAt,
      detectedAt: now,
    })
    .onConflictDoNothing({ target: stripeUnmatchedPayments.stripeSessionId })
    .run();
}
