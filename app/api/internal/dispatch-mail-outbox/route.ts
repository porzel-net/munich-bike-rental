import { NextResponse } from "next/server";

import { dispatchNextOutboxMail, releaseExpiredOutboxLeases } from "../../../../lib/bookings/outbox";

export const runtime = "nodejs";

/** Invoke once per minute from the deployment host with `Authorization: Bearer $OUTBOX_DISPATCH_TOKEN`. */
export async function POST(request: Request) {
  const token = process.env.OUTBOX_DISPATCH_TOKEN?.trim();
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  releaseExpiredOutboxLeases();
  const result = await dispatchNextOutboxMail();
  return NextResponse.json({ ok: true, result });
}
