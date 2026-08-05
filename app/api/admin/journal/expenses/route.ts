import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { message: "Manuelle Journalbeträge sind deaktiviert. Das Finanzjournal wird ausschließlich aus der Nevlo API gespeist." },
    { status: 410 },
  );
}
