import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { importLegacyBookingEmails } from "@/lib/booking-import/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApi(session.user))
    return NextResponse.json(
      { message: "Du hast keine Berechtigung, den alten E-Mail-Import zu starten." },
      { status: 403 },
    );
  try {
    const summary = await importLegacyBookingEmails(getDatabase(), session.user.id);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "E-Mail-Import fehlgeschlagen" },
      { status: 502 },
    );
  }
}
