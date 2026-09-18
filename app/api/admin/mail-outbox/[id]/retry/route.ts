import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { retryFailedOutboxMail } from "@/lib/bookings/outbox";

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

  const retried = retryFailedOutboxMail(getDatabase(), mailId);
  if (!retried)
    return NextResponse.json(
      { message: "Nur fehlgeschlagene Mails können erneut eingereiht werden." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true, status: "queued" });
}
