import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { BookingCommandError } from "@/lib/bookings/errors";
import { createPrivateAssetContribution } from "@/lib/financial/fixed-assets";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  assetType: z.enum(["bike", "equipment", "other"]),
  originalAcquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contributionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCostCents: z.number().int().positive(),
  originalAcquisitionCostCents: z.number().int().positive(),
  originalUsefulLifeMonths: z.number().int().positive(),
  originalCondition: z.enum(["new", "used"]),
  privateUseType: z.enum(["personal", "income_generation", "mixed"]),
  usefulLifeMonths: z.number().int().positive(),
  method: z.enum(["straight_line", "declining_balance"]).default("straight_line"),
  serialNumber: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  if (!hasTrustedOrigin(request) || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      { message: "Du hast keine Berechtigung, eine Privateinlage zu erfassen." },
      { status: 401 },
    );
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success)
    return NextResponse.json(
      {
        message:
          "Die Privateinlage ist unvollständig. Prüfe ursprüngliche Anschaffungskosten, ursprüngliche Nutzungsdauer, Zustand, Vor-Nutzung, Anschaffungsdatum, Einlagedatum und Einlagewert.",
      },
      { status: 400 },
    );
  try {
    return NextResponse.json({
      ok: true,
      ...createPrivateAssetContribution(getDatabase(), { ...input.data, actorUserId: session.user.id }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Die Privateinlage konnte nicht gespeichert werden. Prüfe ursprüngliche Anschaffungskosten, ursprüngliche Nutzungsdauer, Zustand, Vor-Nutzung, Einlagedatum und Einlagewert.",
      },
      { status: 409 },
    );
  }
}
