import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ message: "This legacy mail endpoint is archived. Use booking commands." }, { status: 410 });
}
