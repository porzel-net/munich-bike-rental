import { eq } from "drizzle-orm";

import { confirmOfferWithStripePayment } from "../bookings/service";
import type { AppDatabase } from "../db/client";
import { bookingOffers } from "../db/schema";
import { listStripeCheckoutSessions } from "../stripe";

import { importStripeCheckoutPayment } from "./stripe-payment";

export type StripeSyncInput = {
  createdGte?: number;
  createdLte?: number;
};

export type StripeSyncResult = {
  scanned: number;
  imported: number;
  alreadyImported: number;
  skippedUnpaid: number;
  skippedWithoutOffer: number;
  skippedUnknownOffer: number;
  failed: number;
  errors: string[];
};

function addError(result: StripeSyncResult, message: string) {
  result.failed += 1;
  if (result.errors.length < 20) result.errors.push(message);
}

/**
 * Imports all paid Checkout Sessions that belong to this application's offers.
 * The existing balance-transaction ID check makes this safe to run repeatedly.
 */
export async function syncStripeCheckoutPayments(db: AppDatabase, input: StripeSyncInput = {}) {
  const result: StripeSyncResult = {
    scanned: 0,
    imported: 0,
    alreadyImported: 0,
    skippedUnpaid: 0,
    skippedWithoutOffer: 0,
    skippedUnknownOffer: 0,
    failed: 0,
    errors: [],
  };
  let startingAfter: string | undefined;

  do {
    const page = await listStripeCheckoutSessions({
      ...input,
      startingAfter,
      limit: 100,
    });

    for (const session of page.data) {
      result.scanned += 1;
      if (session.payment_status !== "paid") {
        result.skippedUnpaid += 1;
        continue;
      }

      const offerId = Number(session.metadata?.booking_offer_id);
      if (!Number.isSafeInteger(offerId) || offerId <= 0 || !Number.isSafeInteger(session.amount_total)) {
        result.skippedWithoutOffer += 1;
        continue;
      }

      const offer = db
        .select({ id: bookingOffers.id, bookingId: bookingOffers.bookingId })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, offerId))
        .get();
      if (!offer) {
        result.skippedUnknownOffer += 1;
        continue;
      }

      try {
        await confirmOfferWithStripePayment(db, {
          offerId,
          amountCents: session.amount_total as number,
          sessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent && typeof session.payment_intent === "object"
                ? session.payment_intent.id
                : null,
        });
        const imported = await importStripeCheckoutPayment(db, {
          sessionId: session.id,
          bookingId: offer.bookingId,
        });
        if (imported.alreadyImported) result.alreadyImported += 1;
        else result.imported += 1;
      } catch (error) {
        addError(
          result,
          `${session.id}: ${error instanceof Error ? error.message : "Unbekannter Stripe-Synchronisationsfehler."}`,
        );
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
  } while (startingAfter);

  return result;
}
