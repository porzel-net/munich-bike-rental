import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH() {
  return NextResponse.json(
    { message: "Mutable legacy revenue records are archived. Use journal commands." },
    { status: 410 },
  );
}
