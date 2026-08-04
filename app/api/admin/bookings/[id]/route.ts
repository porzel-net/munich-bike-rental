import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { BookingCommandError, updateBooking } from "@/lib/bookings/service";

export const runtime = "nodejs";

const requestedItem = z.object({
  id: z.number().int().positive(),
  requestedLabel: z.string().trim().min(1).max(120),
  heightCm: z.number().int().min(100).max(250),
  needsPedals: z.boolean(),
  pedalType: z.string().trim().max(32).nullable(),
  needsComputerMount: z.boolean(),
  computerMountType: z.string().trim().max(32).nullable(),
  needsHelmet: z.boolean(),
  needsClothing: z.boolean(),
});

const schema = z.object({
  expectedVersion: z.number().int().positive(),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(1).max(64),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  dropoffTime: z.string().regex(/^\d{2}:\d{2}$/),
  customerMessage: z.string().trim().max(5000),
  communicationLocale: z.enum(["de", "en"]),
  requestedItems: z.array(requestedItem).min(1).max(10),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await request.json().catch(() => null));
  const command = await getBookingAdminContext(request, id);
  if (!command || !input.success) return NextResponse.json({ message: "Ungültige Buchungsdaten" }, { status: 400 });

  try {
    return NextResponse.json(
      updateBooking(command.db, {
        bookingId: id,
        actorUserId: command.user.id,
        ...input.data,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Buchung konnte nicht bearbeitet werden" },
      { status: 409 },
    );
  }
}
