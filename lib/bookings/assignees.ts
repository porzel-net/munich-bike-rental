import { and, asc, eq, or } from "drizzle-orm";

import { isAdmin, isLocationUser, type AuthorizedUser } from "@/lib/auth/authorization";
import type { AppDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema";
import type { RentalLocation } from "@/lib/inquiries/catalog";

export type BookingAssigneeUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "standortuser";
  locationKey: RentalLocation | null;
};

export function isEligibleBookingAssignee(user: AuthorizedUser, location: RentalLocation) {
  return isAdmin(user) || (isLocationUser(user) && user.locationKey === location);
}

export function getAssignableBookingUsers(db: AppDatabase, location: RentalLocation) {
  return db
    .select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
      locationKey: authUser.locationKey,
    })
    .from(authUser)
    .where(or(eq(authUser.role, "admin"), and(eq(authUser.role, "standortuser"), eq(authUser.locationKey, location))))
    .orderBy(asc(authUser.name))
    .all()
    .map((user) => ({
      ...user,
      role: user.role as "admin" | "standortuser",
      locationKey: (user.locationKey as RentalLocation | null) ?? null,
    }));
}
