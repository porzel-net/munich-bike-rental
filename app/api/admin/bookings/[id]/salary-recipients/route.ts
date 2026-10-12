import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdmin } from "@/lib/auth/session";
import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { BookingCommandError, setBookingSalaryRecipients } from "@/lib/bookings/service";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({ recipientUserIds: z.array(z.string().trim().min(1).max(128)).min(1).max(100) });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id);
  if (!command || !input.success)
    return NextResponse.json(
      { message: "Die Gehaltszuweisung ist unvollständig. Wähle mindestens eine gültige Person aus." },
      { status: 400 },
    );
  if (!isAdmin(command.user))
    return NextResponse.json({ message: "Nur Administratoren dürfen Gehaltszuweisungen ändern." }, { status: 403 });

  try {
    return NextResponse.json(
      setBookingSalaryRecipients(command.db, {
        bookingId: id,
        recipientUserIds: input.data.recipientUserIds,
        actorUserId: command.user.id,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError ? error.message : "Gehaltszuweisung konnte nicht gespeichert werden.",
      },
      { status: 409 },
    );
  }
}
