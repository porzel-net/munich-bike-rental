import { and, gte, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { EMAIL_ACTION_START_AT, reviewLatestUnprocessedEmailThread } from "@/lib/inquiries/email-action";
import { syncBookingMailThread } from "@/lib/inquiries/mailbox";

export const runtime = "nodejs";

/** Syncs and checks every not-yet-reviewed mailbox thread from the configured start date onward. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const db = getDatabase();
  const candidates = db
    .select({ id: bookings.id, orderNumber: bookings.orderNumber })
    .from(bookings)
    .where(and(ne(bookings.source, "legacy"), gte(bookings.createdAt, EMAIL_ACTION_START_AT)))
    .all();
  const results = [];

  for (const booking of candidates) {
    try {
      const sync = await syncBookingMailThread(db, booking.id, booking.orderNumber, { reviewNewMessages: false });
      const review = await reviewLatestUnprocessedEmailThread(db, booking.id);
      results.push({ bookingId: booking.id, orderNumber: booking.orderNumber, sync, review });
    } catch (error) {
      console.error("Booking AI batch analysis failed", {
        bookingId: booking.id,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      });
      results.push({
        bookingId: booking.id,
        orderNumber: booking.orderNumber,
        review: { status: "error" as const, message: "Automatische Prüfung fehlgeschlagen." },
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      startDate: EMAIL_ACTION_START_AT.toISOString(),
      candidates: candidates.length,
      checked: results.filter((result) => result.review.status === "checked").length,
      skipped: results.filter((result) => result.review.status === "skipped").length,
      notEligible: results.filter((result) => result.review.status === "not_eligible").length,
      withoutMail: results.filter((result) => result.review.status === "no_message").length,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
