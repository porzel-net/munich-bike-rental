import { NextResponse } from "next/server";

import { BookingCommandError } from "@/lib/bookings/errors";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { attachFinancialDocument, MAX_FINANCIAL_DOCUMENT_BYTES } from "@/lib/financial/documents";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung, Belege zu verwalten." },
      { status: 401 },
    );

  const transactionId = Number((await context.params).id);
  if (!Number.isInteger(transactionId) || transactionId <= 0)
    return NextResponse.json(
      { message: "Die ausgewählte Transaktion ist ungültig oder nicht mehr vorhanden. Aktualisiere die Liste." },
      { status: 400 },
    );
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  const maxRequestBytes = MAX_FINANCIAL_DOCUMENT_BYTES + 128 * 1024;
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return NextResponse.json({ message: "Der Upload ist zu groß." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Der Beleg-Upload konnte nicht gelesen werden." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Bitte wähle einen Beleg aus." }, { status: 400 });
  const description = formData.get("description");
  if (typeof description === "string" && description.length > 1_000) {
    return NextResponse.json(
      { message: "Die Belegbeschreibung darf höchstens 1.000 Zeichen enthalten." },
      { status: 400 },
    );
  }
  try {
    const result = await attachFinancialDocument(getDatabase(), {
      transactionId,
      file,
      userId: session.user.id,
      description: typeof description === "string" ? description : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Der Beleg konnte nicht gespeichert werden. Prüfe Datei, Dateityp, Größe und Beschreibung.",
      },
      { status: 409 },
    );
  }
}
