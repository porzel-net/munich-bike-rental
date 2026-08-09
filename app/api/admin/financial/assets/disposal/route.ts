import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { BookingCommandError } from "@/lib/bookings/errors";
import { disposeFixedAsset } from "@/lib/financial/fixed-assets";
import { readBoundedJson } from "@/lib/security/request-body";
import { isValidIsoDate } from "@/lib/bookings/validation";

export const runtime = "nodejs";

const schema = z.object({
  assetId: z.number().int().positive(),
  financialAccountId: z.number().int().positive(),
  disposedAt: z.string().refine(isValidIsoDate, "Ungültiges Verkaufsdatum"),
  disposalProceedsCents: z.number().int().nonnegative(),
  disposalProceedsVatCents: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session || !hasTrustedOrigin(request) || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success) return NextResponse.json({ message: "Ungültige Verkaufsdaten" }, { status: 400 });
  try {
    return NextResponse.json({
      ok: true,
      ...disposeFixedAsset(getDatabase(), { ...input.data, actorUserId: session.user.id }),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Verkauf konnte nicht erfasst werden." },
      { status: 409 },
    );
  }
}
