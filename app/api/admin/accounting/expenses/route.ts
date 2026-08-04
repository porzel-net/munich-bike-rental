import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ message: "Mutable legacy expense records are archived. Use journal commands." }, { status: 410 });
}
