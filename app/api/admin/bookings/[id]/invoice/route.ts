import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/bookings/invoice-pdf";
import { getBookingPaymentStatus } from "@/lib/bookings/service";
import type { OfferQuote } from "@/lib/bookings/quotes";
import { getDatabase } from "@/lib/db/client";
import { bookingOffers, bookingRequestedItems, bookings } from "@/lib/db/schema";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const session = await getServerSession();
  if (!session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      { message: "Du hast keine Berechtigung, für diese Buchung eine Rechnung zu erstellen." },
      { status: 403 },
    );

  const db = getDatabase();
  const booking = Number.isInteger(id) ? db.select().from(bookings).where(eq(bookings.id, id)).get() : undefined;
  if (!booking)
    return NextResponse.json(
      { message: "Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut." },
      { status: 404 },
    );

  const payment = getBookingPaymentStatus(db, id);
  if (payment.status !== "settled")
    return NextResponse.json(
      { message: "Eine Rechnung kann erst bei vollständig bezahlten Buchungen erstellt werden." },
      { status: 409 },
    );

  const offer = db
    .select()
    .from(bookingOffers)
    .where(and(eq(bookingOffers.bookingId, id), eq(bookingOffers.status, "accepted")))
    .orderBy(desc(bookingOffers.offerNumber))
    .get();
  if (!offer || !booking.invoiceNumber)
    return NextResponse.json(
      { message: "Für diese Buchung liegt noch kein abrechenbares Angebot vor." },
      { status: 409 },
    );

  const requestedItems = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, id)).all();
  const quote = JSON.parse(offer.priceSnapshotJson) as OfferQuote;
  const location =
    rentalLocationLabels.de[booking.location as keyof typeof rentalLocationLabels.de] ?? booking.location;
  const pdf = await renderInvoicePdf({
    invoiceNumber: booking.invoiceNumber,
    issuedAt: booking.invoiceIssuedAt ?? new Date(),
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    orderNumber: booking.orderNumber,
    periodFrom: booking.periodFrom,
    periodTo: booking.periodTo,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    location,
    quote: {
      ...quote,
      offeredItems: quote.offeredItems.filter((item) =>
        requestedItems.some((requested) => requested.id === item.requestedItemId),
      ),
    },
    paidAmountCents: quote.totalCents - payment.openCents,
  });

  // Use a plain Uint8Array for the binary body. This avoids Buffer-specific
  // body handling differences between local Node and the standalone runtime.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `inline; filename="${booking.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
