import { NextResponse } from "next/server";

import { BookingCommandError } from "@/lib/bookings/errors";
import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { attachFinancialDocument } from "@/lib/financial/documents";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const transactionId = Number((await context.params).id);
  if (!Number.isInteger(transactionId) || transactionId <= 0)
    return NextResponse.json({ message: "Ungültige Transaktion" }, { status: 400 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Bitte wähle einen Beleg aus." }, { status: 400 });
  try {
    const result = await attachFinancialDocument(getDatabase(), {
      transactionId,
      file,
      userId: session.user.id,
      description: String(formData.get("description") || ""),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Beleg konnte nicht gespeichert werden." },
      { status: 409 },
    );
  }
}
