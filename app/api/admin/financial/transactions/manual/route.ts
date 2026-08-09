import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { BookingCommandError } from "@/lib/bookings/errors";
import { createAndPostManualTransaction } from "@/lib/financial/manual-transactions";
import { readBoundedJson } from "@/lib/security/request-body";
import { isValidIsoDate } from "@/lib/bookings/validation";

export const runtime = "nodejs";

const schema = z.object({
  accountId: z.number().int().positive().optional(),
  source: z.enum(["cash", "manual"]),
  bookedAt: z.string().refine(isValidIsoDate, "Ungültiges Buchungsdatum"),
  amountCents: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  destinationAccountId: z.number().int().positive().optional(),
  counterpartyName: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1).max(2000),
  note: z.string().trim().max(1000).optional(),
  businessMeal: z
    .object({
      privateShareCents: z.number().int().nonnegative(),
      inputVatCents: z.number().int().nonnegative().optional(),
    })
    .optional(),
  asset: z
    .object({
      name: z.string().trim().min(1).max(200),
      assetType: z.enum(["bike", "equipment", "other"]),
      serialNumber: z.string().trim().max(200).optional(),
      acquisitionDate: z.string().refine(isValidIsoDate, "Ungültiges Anschaffungsdatum"),
      inServiceDate: z.string().refine(isValidIsoDate, "Ungültiges Inbetriebnahmedatum"),
      acquisitionCostCents: z.number().int().positive(),
      inputVatCents: z.number().int().nonnegative().optional(),
      usefulLifeMonths: z.number().int().positive(),
      residualValueCents: z.number().int().nonnegative().optional(),
      notes: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasTrustedOrigin(request) || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success) return NextResponse.json({ message: "Ungültige manuelle Transaktion" }, { status: 400 });
  try {
    const result = createAndPostManualTransaction(getDatabase(), { ...input.data, actorUserId: session.user.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof BookingCommandError ? error.message : "Transaktion konnte nicht gespeichert werden.",
      },
      { status: 409 },
    );
  }
}
