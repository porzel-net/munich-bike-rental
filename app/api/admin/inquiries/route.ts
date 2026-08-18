import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Legacy inquiries are an archive; all writable work moved to /api/admin/bookings. */
export async function GET() {
  return NextResponse.json(
    { message: "Dieser alte Anfrage-Endpunkt ist nicht mehr aktiv. Verwende die Buchungsverwaltung im Admin-Bereich." },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { message: "Dieser alte Anfrage-Endpunkt ist nicht mehr aktiv. Verwende die Buchungsverwaltung im Admin-Bereich." },
    { status: 410 },
  );
}
