import { NextResponse } from "next/server";

import { hasValidInternalBearerToken } from "../../../../lib/auth/internal-token";
import { dispatchNextOutboxMail, releaseExpiredOutboxLeases } from "../../../../lib/bookings/outbox";

export const runtime = "nodejs";

/** Invoke once per minute from the deployment host with `Authorization: Bearer $OUTBOX_DISPATCH_TOKEN`. */
export async function POST(request: Request) {
  if (!hasValidInternalBearerToken(request, process.env, "OUTBOX_DISPATCH_TOKEN")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  releaseExpiredOutboxLeases();
  const result = await dispatchNextOutboxMail();
  return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
}
