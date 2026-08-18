import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { BookingCommandError } from "@/lib/bookings/errors";
import { previewOffer } from "@/lib/bookings/service";
import { readBoundedJson } from "@/lib/security/request-body";
import { isValidIsoDate, isValidTime } from "@/lib/bookings/validation";

export const runtime = "nodejs";

const schema = z.object({
  assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
  accessoriesByRequestedItem: z
    .record(
      z.string(),
      z.object({
        needsPedals: z.boolean(),
        pedalType: z.string().nullable(),
        needsComputerMount: z.boolean(),
        computerMountType: z.string().nullable(),
        needsHelmet: z.boolean(),
        needsClothing: z.boolean(),
        needsBikepackingBag: z.boolean().default(false),
        needsGlasses: z.boolean().default(false),
        bottleHolderIncluded: z.boolean().default(true),
        repairKitIncluded: z.boolean().default(true),
      }),
    )
    .optional(),
  isStudent: z.boolean().optional(),
  alternative: z.boolean().optional(),
  alternativeReason: z.string().trim().max(1000).optional(),
  personalMessage: z.string().trim().max(2000).optional(),
  customTotalCents: z.number().int().min(0).optional(),
  periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum").optional(),
  periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum").optional(),
  pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit").optional(),
  dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit").optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success)
    return NextResponse.json(
      { message: "Die Angebotsvorschau ist unvollständig. Prüfe Zeitraum, Übergabezeiten und Fahrradauswahl." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      previewOffer(command.db, {
        bookingId: id,
        assetsByRequestedItem: Object.fromEntries(
          Object.entries(input.data.assetsByRequestedItem).map(([key, value]) => [Number(key), value]),
        ),
        accessoriesByRequestedItem: input.data.accessoriesByRequestedItem
          ? Object.fromEntries(
              Object.entries(input.data.accessoriesByRequestedItem).map(([key, value]) => [Number(key), value]),
            )
          : undefined,
        isStudent: input.data.isStudent,
        alternative: input.data.alternative,
        alternativeReason: input.data.alternativeReason,
        personalMessage: input.data.personalMessage,
        customTotalCents: input.data.customTotalCents,
        periodFrom: input.data.periodFrom,
        periodTo: input.data.periodTo,
        pickupTime: input.data.pickupTime,
        dropoffTime: input.data.dropoffTime,
        actorUserId: command.user.id,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Die Angebotsvorschau konnte nicht erstellt werden. Prüfe Zeitraum, Übergabezeiten und Fahrradauswahl.",
      },
      { status: 409 },
    );
  }
}
