import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { BookingCommandError } from "@/lib/bookings/errors";
import { postDueFixedAssetDepreciation } from "@/lib/financial/fixed-assets";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({ throughMonth: z.string().regex(/^\d{4}-\d{2}$/) });

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasTrustedOrigin(request) || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success) return NextResponse.json({ message: "Ungültiger AfA-Zeitraum" }, { status: 400 });
  try {
    const result = postDueFixedAssetDepreciation(getDatabase(), { ...input.data, actorUserId: session.user.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "AfA konnte nicht gebucht werden." },
      { status: 409 },
    );
  }
}
