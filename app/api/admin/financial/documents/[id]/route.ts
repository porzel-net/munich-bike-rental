import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { BookingCommandError } from "@/lib/bookings/errors";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialDocumentPath, safeFinancialDocumentFileName } from "@/lib/financial/documents";
import { financialDocuments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (
    (request.headers.get("origin") && !hasTrustedOrigin(request)) ||
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
    const supportedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    return new NextResponse(body, {
      headers: {
        "Content-Type": supportedMimeTypes.has(document.mimeType) ? document.mimeType : "application/octet-stream",
        "Content-Length": String(body.byteLength),
        // Uploaded content is untrusted even after magic-byte validation;
        // force a download instead of allowing inline browser execution.
        "Content-Disposition": `attachment; filename="${safeFinancialDocumentFileName(document.originalFileName)}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BookingCommandError) return NextResponse.json({ message: error.message }, { status: 409 });
    return NextResponse.json({ message: "Belegdatei nicht gefunden" }, { status: 404 });
  }
}
