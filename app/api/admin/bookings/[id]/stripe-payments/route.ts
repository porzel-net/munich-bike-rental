import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { bookingOffers, financialTransactions } from "@/lib/db/schema";
import { listStripeCheckoutSessions } from "@/lib/stripe";

export const runtime = "nodejs";

function bookingIdFromMetadata(metadataJson: string) {
  try {
    const metadata = JSON.parse(metadataJson) as { bookingId?: number };
    return Number.isInteger(metadata.bookingId) ? metadata.bookingId : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const offers = command.db
      .select({ id: bookingOffers.id })
      .from(bookingOffers)
      .where(eq(bookingOffers.bookingId, id))
      .all();
    const bookingOfferIds = new Set(offers.map((offer) => offer.id));
    const linkedStripeTransactions = command.db
      .select({ reference: financialTransactions.reference, metadataJson: financialTransactions.metadataJson })
      .from(financialTransactions)
      .where(
        and(eq(financialTransactions.source, "stripe"), eq(financialTransactions.provider, "stripe")),
      )
      .all();
    const linkedSessions = new Map(
      linkedStripeTransactions
        .filter((transaction) => transaction.reference)
        .map((transaction) => [transaction.reference, bookingIdFromMetadata(transaction.metadataJson)] as const),
    );
    const page = await listStripeCheckoutSessions({
      createdGte: Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1_000) / 1_000),
      limit: 100,
    });

    return NextResponse.json({
      payments: page.data
        .filter((session) => session.payment_status === "paid" && Number.isSafeInteger(session.amount_total))
        .map((session) => ({
          id: session.id,
          amountCents: session.amount_total,
          createdAt: session.created ?? null,
          customerEmail: session.customer_email ?? null,
          offerId: Number(session.metadata?.booking_offer_id) || null,
          offerMatchesBooking: bookingOfferIds.has(Number(session.metadata?.booking_offer_id)),
          assignedBookingId: linkedSessions.get(session.id) ?? null,
        }))
        .filter((payment) => !payment.assignedBookingId || payment.assignedBookingId === id),
    });
  } catch (error) {
    console.error("Stripe payments could not be loaded", { bookingId: id, error });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Stripe-Zahlungen konnten nicht geladen werden." },
      { status: 502 },
    );
  }
}
