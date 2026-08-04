import { NextResponse } from "next/server";

import { canAccessAdmin, getServerSession, isAdmin } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { NevloApiError, NevloConfigurationError } from "../../../../../../lib/nevlo";
import { syncNevloTransactions } from "../../../../../../lib/financial/nevlo-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  const session = await getServerSession();
  if (
    request.headers.get("origin") !== new URL(base).origin ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !isAdmin(session.user)
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    accountId?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
  };
  const input = {
    accountId: typeof body.accountId === "string" ? body.accountId.trim() || undefined : undefined,
    dateFrom: typeof body.dateFrom === "string" ? body.dateFrom.trim() || undefined : undefined,
    dateTo: typeof body.dateTo === "string" ? body.dateTo.trim() || undefined : undefined,
  };
  try {
    const result = await syncNevloTransactions(getDatabase(), input);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof NevloConfigurationError ? 503 : error instanceof NevloApiError ? 502 : 409;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nevlo-Synchronisation fehlgeschlagen." },
      { status },
    );
  }
}

