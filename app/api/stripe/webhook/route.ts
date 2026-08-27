import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { confirmOfferWithStripePayment, BookingCommandError } from "@/lib/bookings/service";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";
import { getDatabase } from "@/lib/db/client";
import { importStripeCheckoutPayment } from "@/lib/financial/stripe-payment";
import { bookingOffers, mailOutbox } from "@/lib/db/schema";
import { readBoundedText } from "@/lib/security/request-body";
import { consumeRequestRateLimit } from "@/lib/security/rate-limit";
import { constructStripeWebhookEvent, StripeConfigurationError } from "@/lib/stripe";

export const runtime = "nodejs";

const PAYMENT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export async function POST(request: Request) {
  if (!consumeRequestRateLimit(request, "stripe-webhook", { max: 60, windowMs: 60_000 })) {
    return NextResponse.json(
      { message: "Zu viele Webhook-Anfragen." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  const payload = await readBoundedText(request, 1 * 1024 * 1024);
  if (payload === null) {
    return NextResponse.json(
      { message: "Stripe-Webhook konnte nicht verarbeitet werden." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const event = constructStripeWebhookEvent(payload, request.headers.get("stripe-signature"));
    if (!PAYMENT_EVENTS.has(event.type))
      return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });

    const session = event.data.object;
    if (event.type === "checkout.session.completed" && session.payment_status !== "paid") {
      return NextResponse.json(
        { received: true, waitingForPayment: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const offerId = Number(session.metadata?.booking_offer_id);
    if (
      !Number.isSafeInteger(offerId) ||
      offerId <= 0 ||
      typeof session.amount_total !== "number" ||
      !Number.isSafeInteger(session.amount_total)
    ) {
      return NextResponse.json(
        { message: "Stripe-Session enthält keine gültige Angebotsreferenz." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const amountCents = session.amount_total;
    if (session.metadata?.booking_offer_id !== String(offerId) || !session.metadata?.booking_id) {
      return NextResponse.json(
        { message: "Die Stripe-Zahlung gehört nicht zu diesem Angebot." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const database = getDatabase();
    const offer = database
      .select({ bookingId: bookingOffers.bookingId })
      .from(bookingOffers)
      .where(eq(bookingOffers.id, offerId))
      .get();
    if (!offer || session.metadata?.booking_id !== String(offer.bookingId)) {
      return NextResponse.json(
        { message: "Die Stripe-Zahlung gehört nicht zu diesem Angebot." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = confirmOfferWithStripePayment(database, {
      offerId,
      amountCents,
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent && typeof session.payment_intent === "object"
            ? session.payment_intent.id
            : null,
      offerToken: session.metadata?.offer_token,
    });

    // The booking journal records the commercial charge, while this import
    // records the actual Stripe cash movement and its fee for EÜR purposes.
    // Repeated webhook deliveries are safe because the Stripe balance
    // transaction ID is unique in the financial layer.
    await importStripeCheckoutPayment(database, { sessionId: session.id, bookingId: result.bookingId });

    if (!result.alreadyConfirmed) {
      const confirmationMailId = database
        .select({ id: mailOutbox.id })
        .from(mailOutbox)
        .where(
          and(
            eq(mailOutbox.bookingId, result.bookingId),
            eq(mailOutbox.kind, "booking_confirmed"),
            eq(mailOutbox.status, "queued"),
          ),
        )
        .get()?.id;
      if (confirmationMailId) await dispatchNextOutboxMail(database, confirmationMailId);
    }

    return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof StripeConfigurationError ? 503 : error instanceof BookingCommandError ? 409 : 400;
    console.error("Stripe webhook processing failed", {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    return NextResponse.json(
      { message: "Stripe-Webhook konnte nicht verarbeitet werden." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
