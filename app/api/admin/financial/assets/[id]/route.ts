import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { BookingCommandError } from "@/lib/bookings/errors";
import { getDatabase } from "@/lib/db/client";
import { updateFixedAsset } from "@/lib/financial/fixed-assets";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  assetType: z.enum(["bike", "equipment", "other"]),
  serialNumber: z.string().trim().max(200).optional().nullable(),
  inServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usefulLifeMonths: z.number().int().positive(),
  notes: z.string().trim().max(1_000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  if (!hasTrustedOrigin(request) || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Du hast keine Berechtigung, Anlagegüter zu ändern." }, { status: 401 });

  const assetId = Number((await context.params).id);
  if (!Number.isInteger(assetId) || assetId <= 0)
    return NextResponse.json({ message: "Die Anlagegut-ID ist ungültig." }, { status: 400 });
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success)
    return NextResponse.json(
      { message: "Die Anlagedaten sind unvollständig. Prüfe Bezeichnung, Datum und Nutzungsdauer." },
      { status: 400 },
    );

  try {
    const asset = updateFixedAsset(getDatabase(), { ...input.data, assetId, actorUserId: session.user.id });
    return NextResponse.json({ ok: true, assetId: asset.id });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Das Anlagegut konnte nicht geändert werden. Prüfe die Eingaben und versuche es erneut.",
      },
      { status: 409 },
    );
  }
}
