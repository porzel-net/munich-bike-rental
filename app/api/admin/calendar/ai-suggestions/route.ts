import { NextResponse } from "next/server";

import { evaluateBikeDisposition } from "@/lib/ai/bike-disposition";
import { getBikeDispositionInput } from "@/lib/ai/bike-disposition-data";
import { getBookingAdminContext } from "@/lib/bookings/admin-guard";

export const runtime = "nodejs";

/** Read-only admin analysis. No booking, allocation, offer, or event is written here. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Ungültige Anfrage." }, { status: 400 });
  }
  const targetBookingId =
    typeof body === "object" && body !== null && "bookingId" in body && typeof body.bookingId === "number"
      ? body.bookingId
      : NaN;
  const command = await getBookingAdminContext(request, targetBookingId);
  if (!command) {
    return NextResponse.json(
      { message: "Deine Admin-Sitzung oder Berechtigung ist nicht mehr gültig." },
      { status: 401 },
    );
  }

  const input = getBikeDispositionInput(command.db, targetBookingId);
  if (!input) return NextResponse.json({ message: "Die Buchung wurde nicht gefunden." }, { status: 404 });

  try {
    const plan = evaluateBikeDisposition(input);
    return NextResponse.json(
      {
        ok: true,
        plan,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Bike disposition analysis failed", {
      bookingId: targetBookingId,
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    return NextResponse.json({ message: "Die Dispositionsanalyse konnte nicht erstellt werden." }, { status: 500 });
  }
}
