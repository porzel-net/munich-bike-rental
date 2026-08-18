import { NextResponse } from "next/server";

export const runtime = "nodejs";

const response = () =>
  NextResponse.json(
    { message: "Dieser alte Anfrage-Endpunkt ist nicht mehr aktiv. Verwende die Aktionen in der Buchungsverwaltung." },
    { status: 410 },
  );

export async function POST() {
  return response();
}
export async function PATCH() {
  return response();
}
