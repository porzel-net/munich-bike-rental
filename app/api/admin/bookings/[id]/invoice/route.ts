import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { renderInvoicePdf } from "@/lib/bookings/invoice-pdf";
import { getBookingPaymentStatus } from "@/lib/bookings/service";
import type { OfferQuote } from "@/lib/bookings/quotes";
import { bookingOffers, bookingRequestedItems } from "@/lib/db/schema";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const command = await getBookingAdminContext(request, id);
  if (!command) return NextResponse.json({ message: "Nicht autorisiert" }, { status: 403 });

  const payment = getBookingPaymentStatus(command.db, id);
  if (payment.status !== "settled")
    return NextResponse.json(
      { message: "Eine Rechnung kann erst bei vollständig bezahlten Buchungen erstellt werden." },
      { status: 409 },
    );

  const offer = command.db
    .select()
    .from(bookingOffers)
    .where(and(eq(bookingOffers.bookingId, id), eq(bookingOffers.status, "accepted")))
    .orderBy(desc(bookingOffers.offerNumber))
    .get();
  if (!offer || !command.booking.invoiceNumber)
    return NextResponse.json(
      { message: "Für diese Buchung liegt noch kein abrechenbares Angebot vor." },
      { status: 409 },
    );

  const requestedItems = command.db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, id))
    .all();
  const quote = JSON.parse(offer.priceSnapshotJson) as OfferQuote;
  const location =
    rentalLocationLabels.de[command.booking.location as keyof typeof rentalLocationLabels.de] ??
    command.booking.location;
  const pdf = await renderInvoicePdf({
    invoiceNumber: command.booking.invoiceNumber,
    issuedAt: command.booking.invoiceIssuedAt ?? new Date(),
    customerName: command.booking.customerName,
    customerEmail: command.booking.customerEmail,
    customerPhone: command.booking.customerPhone,
    orderNumber: command.booking.orderNumber,
    periodFrom: command.booking.periodFrom,
    periodTo: command.booking.periodTo,
    pickupTime: command.booking.pickupTime,
    dropoffTime: command.booking.dropoffTime,
    location,
    quote: {
      ...quote,
      offeredItems: quote.offeredItems.filter((item) =>
        requestedItems.some((requested) => requested.id === item.requestedItemId),
      ),
    },
    paidAmountCents: quote.totalCents - payment.openCents,
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${command.booking.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
