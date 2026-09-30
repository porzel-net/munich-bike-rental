import type { AppDatabase } from "../db/client";
import { stripeUnmatchedPayments, whatsappNotificationOutbox } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
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

  const values = {
    stripePaymentIntentId: paymentIntentId(session),
    amountCents,
    currency: paymentCurrency(session),
    customerEmail: session.customer_email?.trim() || null,
    bookingOfferId: Number.isSafeInteger(offerId) && offerId > 0 ? offerId : null,
    bookingId: Number.isSafeInteger(bookingId) && bookingId > 0 ? bookingId : null,
    reason,
    occurredAt,
    lastCheckedAt: now,
  };
  const existing = db
    .select({ resolvedAt: stripeUnmatchedPayments.resolvedAt })
    .from(stripeUnmatchedPayments)
    .where(eq(stripeUnmatchedPayments.stripeSessionId, session.id))
    .get();

  if (existing) {
    return db
      .update(stripeUnmatchedPayments)
      .set({
        ...values,
        // A payment can only become a new alert after it had actually been
        // reconciled. Repeated scheduler runs must not create alert noise.
        ...(existing.resolvedAt ? { resolvedAt: null, detectedAt: now } : {}),
      })
      .where(eq(stripeUnmatchedPayments.stripeSessionId, session.id))
      .run();
  }

  return db
    .insert(stripeUnmatchedPayments)
    .values({ stripeSessionId: session.id, ...values, detectedAt: now, resolvedAt: null })
    .onConflictDoNothing({ target: stripeUnmatchedPayments.stripeSessionId })
    .run();
}

/**
 * Clears an earlier alert once the scheduler has verified the same Checkout
 * Session against a completed booking. Sent messages remain auditable; queued
 * or retrying messages are removed so a fixed payment is not announced late.
 */
export function resolveMatchedStripePayment(db: AppDatabase, sessionId: string, now = new Date()) {
  const payment = db
    .select({ id: stripeUnmatchedPayments.id, resolvedAt: stripeUnmatchedPayments.resolvedAt })
    .from(stripeUnmatchedPayments)
    .where(eq(stripeUnmatchedPayments.stripeSessionId, sessionId))
    .get();
  if (!payment || payment.resolvedAt) return false;

  const activityId = `stripe-unmatched-payment-${payment.id}`;
  db.update(stripeUnmatchedPayments)
    .set({ resolvedAt: now, lastCheckedAt: now })
    .where(eq(stripeUnmatchedPayments.id, payment.id))
    .run();
  db.delete(whatsappNotificationOutbox)
    .where(
      and(
        eq(whatsappNotificationOutbox.activityId, activityId),
        inArray(whatsappNotificationOutbox.status, ["queued", "failed"]),
      ),
    )
    .run();
  return true;
}
