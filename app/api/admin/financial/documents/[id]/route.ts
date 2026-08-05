import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { BookingCommandError } from "@/lib/bookings/errors";
import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialDocumentPath } from "@/lib/financial/documents";
import { financialDocuments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  const session = await getServerSession();
  if (
    (request.headers.get("origin") && request.headers.get("origin") !== new URL(base).origin) ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !isAdmin(session.user)
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: "Ungültiger Beleg" }, { status: 400 });
  const document = getDatabase().select().from(financialDocuments).where(eq(financialDocuments.id, id)).get();
  if (!document) return NextResponse.json({ message: "Beleg nicht gefunden" }, { status: 404 });
  try {
    const body = await readFile(financialDocumentPath(document.storageKey));
    return new NextResponse(body, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `inline; filename="${document.originalFileName.replace(/["\\\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BookingCommandError) return NextResponse.json({ message: error.message }, { status: 409 });
    return NextResponse.json({ message: "Belegdatei nicht gefunden" }, { status: 404 });
  }
}
