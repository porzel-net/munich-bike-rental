import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicBookingByToken, getPublicOfferByToken } from "@/lib/bookings/public";
import { getDatabase } from "@/lib/db/client";
import { createStripeCheckoutSession, StripeConfigurationError } from "@/lib/stripe";

export const runtime = "nodejs";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

function getAppOrigin(requestUrl: string) {
  return (process.env.APP_ORIGIN?.trim() || new URL(requestUrl).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const input = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Ungültiger Buchungslink" }, { status: 400 });

  const database = getDatabase();
  const offer =
    getPublicOfferByToken(database, input.data.token) ?? getPublicBookingByToken(database, input.data.token);
  if (!offer || !offer.offerId || offer.status !== "sent" || !offer.totalCents || !offer.expiresAt) {
    return NextResponse.json({ message: "Dieses Angebot ist nicht mehr zahlbar." }, { status: 409 });
  }
  if (new Date(offer.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ message: "Dieses Angebot ist abgelaufen." }, { status: 409 });
  }

  try {
    const origin = getAppOrigin(request.url);
    const offerPath = `/angebot/${encodeURIComponent(input.data.token)}`;
    const session = await createStripeCheckoutSession({
      amountCents: offer.totalCents,
      customerEmail: offer.booking.email,
      clientReferenceId: offer.booking.orderNumber,
      productName: `Bike-Verleih ${offer.booking.orderNumber}`,
      productDescription: `Verbindliche Buchung – Angebot ${offer.offerNumber ?? ""}`.trim(),
      successUrl: `${origin}${offerPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${offerPath}?payment=cancelled`,
      metadata: {
        booking_offer_id: String(offer.offerId),
        booking_id: String(offer.booking.id),
        offer_total_cents: String(offer.totalCents),
      },
    });

    return NextResponse.json(
      { url: session.url, sessionId: session.id, amountCents: offer.totalCents },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof StripeConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Die Stripe-Zahlung konnte nicht gestartet werden.";
    return NextResponse.json({ message }, { status: error instanceof StripeConfigurationError ? 503 : 502 });
  }
}
