import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Legacy inquiries are an archive; all writable work moved to /api/admin/bookings. */
export async function GET() {
  return NextResponse.json({ message: "This legacy endpoint is archived. Use /api/admin/bookings." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ message: "This legacy endpoint is archived. Use /api/admin/bookings." }, { status: 410 });
}
