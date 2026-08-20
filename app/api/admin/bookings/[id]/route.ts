import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { BookingCommandError, updateBooking } from "@/lib/bookings/service";
import { isValidIsoDate, isValidTime } from "@/lib/bookings/validation";
import { readBoundedJson } from "@/lib/security/request-body";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";

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
  needsBikepackingBag: z.boolean().default(false),
  needsGlasses: z.boolean().default(false),
  bottleHolderIncluded: z.boolean().default(true),
  repairKitIncluded: z.boolean().default(true),
  insuranceProtectionSelected: z.boolean().optional(),
});

const schema = z.object({
  expectedVersion: z.number().int().positive(),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(1).max(64),
  periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
  periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
  pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
  dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
  customerMessage: z.string().trim().max(5000),
  communicationLocale: z.enum(["de", "en"]),
  requestedItems: z.array(requestedItem).min(1).max(10),
  quotedTotalCents: z.number().int().min(0).optional(),
  notifyCustomer: z.boolean().optional(),
  assetsByRequestedItem: z.record(z.string(), z.number().int().positive()).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success)
    return NextResponse.json(
      {
        message:
          "Die Buchungsdaten sind unvollständig oder ungültig. Prüfe die geänderten Felder und versuche es erneut.",
      },
      { status: 400 },
    );

  try {
    const result = updateBooking(command.db, {
      bookingId: id,
      actorUserId: command.user.id,
      ...input.data,
      assetsByRequestedItem: input.data.assetsByRequestedItem
        ? Object.fromEntries(
            Object.entries(input.data.assetsByRequestedItem).map(([itemId, assetId]) => [Number(itemId), assetId]),
          )
        : undefined,
    });
    const mailResult = result.mailId ? await dispatchNextOutboxMail(command.db, result.mailId) : null;
    if (mailResult?.status === "failed")
      return NextResponse.json(
        {
          message: "Die Buchung wurde gespeichert, aber die Änderungsmail konnte nicht versendet werden.",
          mailStatus: mailResult.status,
        },
        { status: 502 },
      );
    return NextResponse.json({ ...result, mailStatus: mailResult?.status ?? null });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Buchung konnte nicht bearbeitet werden" },
      { status: 409 },
    );
  }
}
