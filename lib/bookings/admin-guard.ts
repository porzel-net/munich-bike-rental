import { eq } from "drizzle-orm";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessAdmin, canAccessLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import type { RentalLocation } from "@/lib/inquiries/catalog";

type BookingAdminContextOptions = {
  /** Require the current user to be the assigned handler unless they are an admin. */
  requireAssignee?: boolean;
};

/** Shared guard for every booking endpoint that reads or changes booking-scoped data. */
export async function getBookingAdminContext(
  request: Request,
  bookingId: number,
  options: BookingAdminContextOptions = {},
) {
  if (!Number.isInteger(bookingId) || !hasTrustedOrigin(request)) return null;
  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user)) return null;
  const db = getDatabase();
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking || !canAccessLocation(session.user, booking.location as RentalLocation)) return null;
  if (options.requireAssignee && !isAdmin(session.user) && booking.assignedUserId !== session.user.id) return null;
  return { db, booking, user: session.user };
}
