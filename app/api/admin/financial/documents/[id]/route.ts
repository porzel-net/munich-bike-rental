import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { BookingCommandError } from "@/lib/bookings/errors";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialDocumentPath, safeFinancialDocumentFileName } from "@/lib/financial/documents";
import { financialDocuments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if ((request.headers.get("origin") && !hasTrustedOrigin(request)) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung, diesen Beleg zu laden." },
      { status: 401 },
    );

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ message: "Die Beleg-ID ist ungültig." }, { status: 400 });
  const document = getDatabase().select().from(financialDocuments).where(eq(financialDocuments.id, id)).get();
  if (!document)
    return NextResponse.json(
      { message: "Der Beleg wurde nicht gefunden. Aktualisiere die Transaktion und versuche es erneut." },
      { status: 404 },
    );
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
    return NextResponse.json({ message: "Die Belegdatei ist nicht mehr auf dem Server vorhanden." }, { status: 404 });
  }
}
