import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicBookingByToken, getPublicBookingContactEmail, getPublicOfferByToken } from "@/lib/bookings/public";
import { getDatabase } from "@/lib/db/client";
import { bookingOffers } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";
import { consumePublicOfferRequestRateLimit } from "@/lib/security/rate-limit";
import {
  createStripeCheckoutSession,
  getStripeCheckoutSession,
  StripeConfigurationError,
  type StripeCheckoutSession,
} from "@/lib/stripe";

export const runtime = "nodejs";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

function getAppOrigin(requestUrl: string) {
  const configured = process.env.APP_ORIGIN?.trim() || process.env.BETTER_AUTH_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new StripeConfigurationError("APP_ORIGIN muss in production konfiguriert sein.");
    }
    return new URL(requestUrl).origin;
  }
  try {
    const origin = new URL(configured);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") throw new Error("invalid protocol");
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
      throw new StripeConfigurationError("APP_ORIGIN muss in production HTTPS verwenden.");
    }
    return origin.origin;
  } catch {
    throw new StripeConfigurationError("APP_ORIGIN muss eine gültige HTTP(S)-URL sein.");
  }
}

function assertCheckoutSessionMatchesOffer(
  session: StripeCheckoutSession,
  offerId: number,
  bookingId: number,
  totalCents: number,
) {
  if (
    session.metadata?.booking_offer_id !== String(offerId) ||
    session.metadata?.booking_id !== String(bookingId) ||
    session.amount_total !== totalCents ||
    session.currency?.toLowerCase() !== "eur"
  ) {
    throw new StripeConfigurationError("Die gespeicherte Stripe-Session gehört nicht sicher zu diesem Angebot.");
  }
}

export async function POST(request: Request) {
  const input = tokenSchema.safeParse(await readBoundedJson(request, 16 * 1024));
  if (!input.success) return NextResponse.json({ message: "Ungültiger Buchungslink" }, { status: 400 });
  if (!consumePublicOfferRequestRateLimit(request, "checkout", input.data.token, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { message: "Zu viele Zahlungsversuche. Bitte versuche es später erneut." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }

  const database = getDatabase();
  const offer =
    getPublicOfferByToken(database, input.data.token) ?? getPublicBookingByToken(database, input.data.token);
  const customerEmail = getPublicBookingContactEmail(database, input.data.token);
  if (!offer || !customerEmail || !offer.offerId || offer.status !== "sent" || !offer.totalCents || !offer.expiresAt) {
    return NextResponse.json({ message: "Dieses Angebot ist nicht mehr zahlbar." }, { status: 409 });
  }
  if (new Date(offer.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ message: "Dieses Angebot ist abgelaufen." }, { status: 409 });
  }

  try {
    const origin = getAppOrigin(request.url);
    const offerPath = `/angebot/${encodeURIComponent(input.data.token)}`;
    const storedSession = database
      .select({ stripeSessionId: bookingOffers.stripeSessionId })
      .from(bookingOffers)
      .where(and(eq(bookingOffers.id, offer.offerId), eq(bookingOffers.status, "sent")))
      .get()?.stripeSessionId;
    if (storedSession) {
      const existingSession = await getStripeCheckoutSession(storedSession);
      assertCheckoutSessionMatchesOffer(existingSession, offer.offerId, offer.booking.id, offer.totalCents);
      if (existingSession.status !== "expired") {
        if (!existingSession.url) throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
        return NextResponse.json(
          { url: existingSession.url, sessionId: existingSession.id, amountCents: offer.totalCents },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const idempotencyKey = `booking-offer-checkout:${offer.offerId}${storedSession ? `:${storedSession}` : ""}`;
    const session = await createStripeCheckoutSession({
      amountCents: offer.totalCents,
      customerEmail,
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
      idempotencyKey,
    });
    database
      .update(bookingOffers)
      .set({ stripeSessionId: session.id })
      .where(and(eq(bookingOffers.id, offer.offerId), eq(bookingOffers.status, "sent")))
      .run();

    return NextResponse.json(
      { url: session.url, sessionId: session.id, amountCents: offer.totalCents },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Stripe checkout creation failed", {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    return NextResponse.json(
      { message: "Die Zahlung konnte derzeit nicht gestartet werden." },
      { status: error instanceof StripeConfigurationError ? 503 : 502 },
    );
  }
}
