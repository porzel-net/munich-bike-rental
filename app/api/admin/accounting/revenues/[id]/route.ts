import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH() {
  return NextResponse.json(
    { message: "Diese alten Ertragsdatensätze sind schreibgeschützt. Erfasse Änderungen über die Journalbuchung." },
    { status: 410 },
  );
}
