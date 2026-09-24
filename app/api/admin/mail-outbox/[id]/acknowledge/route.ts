import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { acknowledgeOutboxMail, MAX_MAIL_ATTEMPTS } from "@/lib/bookings/outbox";
import { getDatabase } from "@/lib/db/client";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });

  const mailId = Number((await context.params).id);
  if (!Number.isSafeInteger(mailId) || mailId <= 0)
    return NextResponse.json({ message: "Ungültige Mail-ID." }, { status: 400 });

  const acknowledged = acknowledgeOutboxMail(getDatabase(), mailId);
  if (!acknowledged)
    return NextResponse.json(
      { message: `Nur endgültig fehlgeschlagene Mails ab ${MAX_MAIL_ATTEMPTS} Versuchen können bestätigt werden.` },
      { status: 409 },
    );
  return NextResponse.json({ ok: true, status: "acknowledged" });
}
