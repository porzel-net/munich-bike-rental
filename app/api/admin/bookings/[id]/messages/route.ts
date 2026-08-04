import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { canAccessAdmin, canAccessLocation, getServerSession } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { bookings, communicationMessages } from "../../../../../../lib/db/schema";
import { syncBookingMailThread } from "../../../../../../lib/inquiries/mailbox";
import type { RentalLocation } from "../../../../../../lib/inquiries/catalog";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const id = Number((await context.params).id);
  const db = getDatabase();
  const booking = Number.isInteger(id) ? db.select().from(bookings).where(eq(bookings.id, id)).get() : undefined;
  if (!session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user) || !booking || !canAccessLocation(session.user, booking.location as RentalLocation)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const sync = await syncBookingMailThread(db, booking.id, booking.orderNumber);
  const messages = db.select().from(communicationMessages).where(eq(communicationMessages.bookingId, booking.id)).orderBy(communicationMessages.sentAt).all();
  return NextResponse.json({ sync, messages }, { headers: { "Cache-Control": "no-store" } });
}
