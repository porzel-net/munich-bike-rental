import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { confirmOfferWithStripePayment, BookingCommandError } from "@/lib/bookings/service";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";
import { getDatabase } from "@/lib/db/client";
import { mailOutbox } from "@/lib/db/schema";
import { constructStripeWebhookEvent, StripeConfigurationError } from "@/lib/stripe";

export const runtime = "nodejs";

const PAYMENT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    const event = constructStripeWebhookEvent(payload, request.headers.get("stripe-signature"));
    if (!PAYMENT_EVENTS.has(event.type)) return NextResponse.json({ received: true });

    const session = event.data.object;
    if (event.type === "checkout.session.completed" && session.payment_status !== "paid") {
      return NextResponse.json({ received: true, waitingForPayment: true });
    }

    const offerId = Number(session.metadata?.booking_offer_id);
    if (
      !Number.isSafeInteger(offerId) ||
      offerId <= 0 ||
      typeof session.amount_total !== "number" ||
      !Number.isSafeInteger(session.amount_total)
    ) {
      return NextResponse.json({ message: "Stripe-Session enthält keine gültige Angebotsreferenz." }, { status: 400 });
    }
    const amountCents = session.amount_total;

    const database = getDatabase();
    const result = confirmOfferWithStripePayment(database, {
      offerId,
      amountCents,
      sessionId: session.id,
    });

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

    return NextResponse.json({ received: true });
  } catch (error) {
    const status = error instanceof StripeConfigurationError ? 503 : error instanceof BookingCommandError ? 409 : 400;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Stripe-Webhook konnte nicht verarbeitet werden." },
      { status },
    );
  }
}
