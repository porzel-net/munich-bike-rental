import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { canAccessAdmin, canAccessLocation, getServerSession } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { bookings, communicationMessages } from "../../../../../../lib/db/schema";
import { syncBookingMailThread } from "../../../../../../lib/inquiries/mailbox";
import type { RentalLocation } from "../../../../../../lib/inquiries/catalog";

export const runtime = "nodejs";

function isLegacyInquiryMessage(
  message: typeof communicationMessages.$inferSelect,
  orderNumber: string,
  customerMessage: string,
) {
  const subject = message.subject.trim();
  const plainText = message.plainText.trim();
  const isInquirySubject = new RegExp(
    `^(Neue Bike-Anfrage|New bike inquiry)\\s+${orderNumber.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`,
    "i",
  ).test(subject);
  if (message.direction !== "inbound" || !isInquirySubject) return false;

  const isSyntheticFormMessage = !message.rfcMessageId && plainText === customerMessage.trim();
  const isOldInternalCopy =
    Boolean(message.rfcMessageId) &&
    (plainText.includes(`Auftragsnummer: ${orderNumber}`) || plainText.includes(`Order number: ${orderNumber}`)) &&
    (plainText.includes("Bike-Details:") || plainText.includes("Bike details:"));
  return isSyntheticFormMessage || isOldInternalCopy;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const id = Number((await context.params).id);
  const db = getDatabase();
  const booking = Number.isInteger(id) ? db.select().from(bookings).where(eq(bookings.id, id)).get() : undefined;
  if (
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !booking ||
    !canAccessLocation(session.user, booking.location as RentalLocation)
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  db.delete(communicationMessages)
    .where(
      and(
        eq(communicationMessages.bookingId, booking.id),
        eq(communicationMessages.direction, "inbound"),
        isNull(communicationMessages.rfcMessageId),
        eq(
          communicationMessages.subject,
          `${booking.communicationLocale === "de" ? "Neue Bike-Anfrage" : "New bike inquiry"} ${booking.orderNumber}`,
        ),
        eq(communicationMessages.plainText, booking.customerMessage),
      ),
    )
    .run();
  const sync = await syncBookingMailThread(db, booking.id, booking.orderNumber);
  const messages = db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.bookingId, booking.id))
    .orderBy(communicationMessages.sentAt)
    .all()
    .filter((message) => !isLegacyInquiryMessage(message, booking.orderNumber, booking.customerMessage));
  return NextResponse.json({ sync, messages }, { headers: { "Cache-Control": "no-store" } });
}
