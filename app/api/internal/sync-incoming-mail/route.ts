import { NextResponse } from "next/server";

import { getDatabase } from "../../../../lib/db/client";
import { bookings } from "../../../../lib/db/schema";
import { syncBookingMailThread } from "../../../../lib/inquiries/mailbox";

export const runtime = "nodejs";

/** Poll this endpoint from the deployment host every minute with `Authorization: Bearer $MAIL_SYNC_TOKEN`. */
export async function POST(request: Request) {
  const token = process.env.MAIL_SYNC_TOKEN?.trim();
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const db = getDatabase();
  const bookingRows = db.select({ id: bookings.id, orderNumber: bookings.orderNumber }).from(bookings).all();
  const results = [];
  for (const booking of bookingRows) {
    results.push({
      bookingId: booking.id,
      orderNumber: booking.orderNumber,
      result: await syncBookingMailThread(db, booking.id, booking.orderNumber),
    });
  }
  return NextResponse.json({ ok: true, bookings: results });
}
