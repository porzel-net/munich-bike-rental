import { eq } from "drizzle-orm";

import { canAccessAdmin, canAccessLocation, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import type { RentalLocation } from "@/lib/inquiries/catalog";

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseUrl = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseUrl).origin;
}

/** Shared command guard for every state-changing or preview-only admin booking endpoint. */
export async function getBookingAdminContext(request: Request, bookingId: number) {
  if (!Number.isInteger(bookingId) || !hasTrustedOrigin(request)) return null;
  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user)) return null;
  const db = getDatabase();
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking || !canAccessLocation(session.user, booking.location as RentalLocation)) return null;
  return { db, booking, user: session.user };
}
