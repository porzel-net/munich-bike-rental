import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessLocation, canUseAdminApi, getServerSession, isAdmin } from "@/lib/auth/session";
import { BookingCommandError, assignBooking } from "@/lib/bookings/service";
import { getDatabase } from "@/lib/db/client";
import { bookings, authUser } from "@/lib/db/schema";
import { isEligibleBookingAssignee } from "@/lib/bookings/assignees";
import type { RentalLocation } from "@/lib/inquiries/catalog";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({ assigneeUserId: z.string().min(1) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  if (!Number.isInteger(id) || !input.success || !hasTrustedOrigin(request))
    return NextResponse.json(
      { message: "Die Zuweisung ist unvollständig. Wähle eine gültige Buchung und einen Sachbearbeiter aus." },
      { status: 400 },
    );

  const session = await getServerSession();
  if (!session || !canUseAdminApi(session.user)) {
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  }

  const db = getDatabase();
  const booking = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!booking || !canAccessLocation(session.user, booking.location as RentalLocation)) {
    return NextResponse.json({ message: "Du hast keine Berechtigung, diese Buchung zuzuweisen." }, { status: 401 });
  }
  const activeAssignee = booking.assignedUserId
    ? db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, booking.assignedUserId)).get()
    : null;

  const targetUser = db
    .select({
      id: authUser.id,
      name: authUser.name,
      role: authUser.role,
      locationKey: authUser.locationKey,
    })
    .from(authUser)
    .where(eq(authUser.id, input.data.assigneeUserId))
    .get();
  if (!targetUser)
    return NextResponse.json(
      {
        message: "Der ausgewählte Sachbearbeiter wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.",
      },
      { status: 404 },
    );
  if (!isEligibleBookingAssignee(targetUser, booking.location as RentalLocation)) {
    return NextResponse.json(
      {
        message:
          "Der ausgewählte Sachbearbeiter ist diesem Standort nicht zugeordnet und kann die Buchung daher nicht übernehmen.",
      },
      { status: 409 },
    );
  }

  if (!isAdmin(session.user)) {
    if (input.data.assigneeUserId !== session.user.id) {
      return NextResponse.json(
        { message: "Als Standortbenutzer kannst du nur dich selbst als Sachbearbeiter eintragen." },
        { status: 403 },
      );
    }
    if (activeAssignee && activeAssignee.id !== session.user.id) {
      return NextResponse.json(
        {
          message:
            "Diese Buchung ist bereits einem anderen Sachbearbeiter zugewiesen. Entferne zuerst die bestehende Zuweisung oder bitte den zuständigen Administrator.",
        },
        { status: 409 },
      );
    }
  }

  try {
    return NextResponse.json(
      assignBooking(db, {
        bookingId: id,
        assigneeUserId: input.data.assigneeUserId,
        actorUserId: session.user.id,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError ? error.message : "Sachbearbeiter konnte nicht gespeichert werden",
      },
      { status: 409 },
    );
  }
}
