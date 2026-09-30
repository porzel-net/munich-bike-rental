import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { bookingOffers } from "../db/schema";
import { expireStripeCheckoutSession, getStripeCheckoutSession } from "../stripe";
import { recordUnmatchedStripePayment } from "../financial/stripe-unmatched-payment";

const INVALID_OFFER_STATUSES = ["expired", "revoked"] as const;

/**
 * Stripe is external to the database transaction that invalidates an offer.
 * Persisting the invalidation marker lets this worker retry safely after a
 * process crash or a temporary Stripe error.
 */
export async function expireInvalidatedStripeCheckoutSessions(db: AppDatabase) {
  const offers = db
    .select({ id: bookingOffers.id, stripeSessionId: bookingOffers.stripeSessionId, status: bookingOffers.status })
    .from(bookingOffers)
    .where(
      and(
        inArray(bookingOffers.status, INVALID_OFFER_STATUSES),
        isNotNull(bookingOffers.stripeSessionId),
        isNull(bookingOffers.stripeSessionInvalidatedAt),
      ),
    )
    .all();

  let invalidated = 0;
  let failed = 0;
  for (const offer of offers) {
    // The database predicate above proves this is non-null; retain the guard
    // so a corrupted legacy row cannot result in an external API call.
    if (!offer.stripeSessionId) continue;
    try {
      const session = await getStripeCheckoutSession(offer.stripeSessionId);
      if (session.payment_status === "paid") {
        recordUnmatchedStripePayment(
          db,
          session,
          `Stripe-Zahlung für ein ${offer.status === "revoked" ? "widerrufenes" : "abgelaufenes"} Angebot.`,
        );
      } else if (session.status === "open") {
        await expireStripeCheckoutSession(offer.stripeSessionId);
      }
      db.update(bookingOffers)
        .set({ stripeSessionInvalidatedAt: new Date() })
        .where(
          and(
            eq(bookingOffers.id, offer.id),
            inArray(bookingOffers.status, INVALID_OFFER_STATUSES),
            isNull(bookingOffers.stripeSessionInvalidatedAt),
          ),
        )
        .run();
      invalidated += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to invalidate obsolete Stripe Checkout Session", {
        offerId: offer.id,
        sessionId: offer.stripeSessionId,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });
    }
  }
  return { scanned: offers.length, invalidated, failed };
}
