import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { communicationMessages } from "@/lib/db/schema";
import { reviewBookingEmailThread } from "@/lib/inquiries/email-action";
import { syncBookingMailThread } from "@/lib/inquiries/mailbox";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { db, booking } = command;

  try {
    const sync = await syncBookingMailThread(db, booking.id, booking.orderNumber);
    const latestMessage = db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.bookingId, booking.id))
      .orderBy(desc(communicationMessages.sentAt), desc(communicationMessages.id))
      .get();
    if (!latestMessage)
      return NextResponse.json(
        { message: "Für diese Buchung wurde noch kein Mailverlauf gefunden.", sync },
        { status: 422 },
      );

    const review = await reviewBookingEmailThread(db, booking.id, latestMessage.id, { force: true });
    if (!review)
      return NextResponse.json(
        { message: "Diese Anfrage liegt vor dem 01.08.2026 und wird nicht automatisch geprüft.", sync },
        { status: 422 },
      );
    return NextResponse.json({ ok: true, sync, review }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Booking AI analysis failed", {
      bookingId: booking.id,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    return NextResponse.json({ message: "KI-Analyse konnte nicht gestartet werden." }, { status: 500 });
  }
}
