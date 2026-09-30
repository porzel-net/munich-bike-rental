import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { authUser } from "../db/schema/auth";
import { BookingCommandError } from "../bookings/errors";

/** A null person is the explicit shared-business default. */
export function resolveInternalPersonId(db: AppDatabase, internalPersonId: string | null | undefined) {
  if (internalPersonId == null || internalPersonId === "") return null;
  const person = db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, internalPersonId)).get();
  if (!person) throw new BookingCommandError("Die ausgewählte interne Person ist nicht mehr verfügbar.");
  return person.id;
}
