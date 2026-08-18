import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      message: "Dieser alte Mail-Endpunkt ist nicht mehr aktiv. Verwende die Mail-Aktionen in der Buchungsverwaltung.",
    },
    { status: 410 },
  );
}
