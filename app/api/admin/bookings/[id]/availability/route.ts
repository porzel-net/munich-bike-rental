import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { hasAssetConflict } from "@/lib/bookings/availability";
import { isValidIsoDate, isValidTime } from "@/lib/bookings/validation";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  assetIds: z.array(z.number().int().positive()).max(500),
  periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
  periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
  pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
  dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success)
    return NextResponse.json({ message: "Die Verfügbarkeitsprüfung ist unvollständig." }, { status: 400 });

  if (input.data.periodFrom > input.data.periodTo)
    return NextResponse.json(
      { message: "Das Rückgabedatum muss am oder nach dem Abholdatum liegen." },
      { status: 400 },
    );

  const bookingForPeriod = {
    ...command.booking,
    periodFrom: input.data.periodFrom,
    periodTo: input.data.periodTo,
    pickupTime: input.data.pickupTime,
    dropoffTime: input.data.dropoffTime,
  };
  const unavailableAssetIds = input.data.assetIds.filter((assetId) =>
    hasAssetConflict(command.db, bookingForPeriod, assetId),
  );

  return NextResponse.json({ unavailableAssetIds });
}
