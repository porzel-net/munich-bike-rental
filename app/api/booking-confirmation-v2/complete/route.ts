import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicBookingByToken, getPublicOfferByToken } from "@/lib/bookings/public";
import { confirmOfferWithStripePayment, BookingCommandError } from "@/lib/bookings/service";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";
import { getDatabase } from "@/lib/db/client";
import { importStripeCheckoutPayment } from "@/lib/financial/stripe-payment";
import { mailOutbox } from "@/lib/db/schema";
import { getStripeCheckoutSession, StripeConfigurationError } from "@/lib/stripe";

export const runtime = "nodejs";

const inputSchema = z.object({
  token: z.string().min(20).max(200),
  sessionId: z.string().min(10).max(200),
});

function getOffer(database: ReturnType<typeof getDatabase>, token: string) {
  return getPublicOfferByToken(database, token) ?? getPublicBookingByToken(database, token);
}

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Ungültige Stripe-Zahlung" }, { status: 400 });

  const database = getDatabase();
  const offer = getOffer(database, input.data.token);
  if (!offer || !offer.offerId || !offer.expiresAt) {
    return NextResponse.json({ message: "Dieses Angebot ist nicht mehr zahlbar." }, { status: 409 });
  }
  if (offer.status !== "sent" && offer.status !== "accepted") {
    return NextResponse.json({ message: "Dieses Angebot ist nicht mehr aktiv." }, { status: 409 });
  }

  try {
    const session = await getStripeCheckoutSession(input.data.sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Die Stripe-Zahlung ist noch nicht als bezahlt bestätigt." },
        { status: 409 },
      );
    }
    if (session.metadata?.booking_offer_id !== String(offer.offerId)) {
      return NextResponse.json({ message: "Die Stripe-Zahlung gehört nicht zu diesem Angebot." }, { status: 409 });
    }
    if (session.amount_total !== offer.totalCents) {
      return NextResponse.json({ message: "Der Stripe-Betrag stimmt nicht mit dem Angebot überein." }, { status: 409 });
    }

    const result = confirmOfferWithStripePayment(database, {
      offerId: offer.offerId,
      amountCents: session.amount_total,
      sessionId: session.id,
    });
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

    const updatedOffer = getOffer(database, input.data.token);
    return NextResponse.json({ ok: true, offer: updatedOffer });
  } catch (error) {
    const status = error instanceof StripeConfigurationError ? 503 : error instanceof BookingCommandError ? 409 : 502;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Die Stripe-Zahlung konnte nicht bestätigt werden." },
      { status },
    );
  }
}
