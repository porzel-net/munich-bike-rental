import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { message: "Diese alten Aufwandsdatensätze sind schreibgeschützt. Erfasse neue Aufwände über die Journalbuchung." },
    { status: 410 },
  );
}
