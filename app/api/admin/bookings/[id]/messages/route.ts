import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getBookingAdminContext } from "../../../../../../lib/bookings/admin-guard";
import { communicationMessages } from "../../../../../../lib/db/schema";
import { syncBookingMailThread } from "../../../../../../lib/inquiries/mailbox";

export const runtime = "nodejs";

function readMessages(
  db: Parameters<typeof syncBookingMailThread>[0],
  bookingId: number,
  orderNumber: string,
  customerMessage: string,
) {
  return db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.bookingId, bookingId))
    .orderBy(communicationMessages.sentAt)
    .all()
    .filter((message) => !isLegacyInquiryMessage(message, orderNumber, customerMessage));
}

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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { db, booking } = command;
  return NextResponse.json(
    { messages: readMessages(db, booking.id, booking.orderNumber, booking.customerMessage) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { db, booking } = command;
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
  return NextResponse.json(
    { sync, messages: readMessages(db, booking.id, booking.orderNumber, booking.customerMessage) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
