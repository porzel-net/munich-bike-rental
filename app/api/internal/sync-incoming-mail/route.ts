import { NextResponse } from "next/server";

import { hasValidInternalBearerToken } from "../../../../lib/auth/internal-token";
import { syncIncomingMail } from "../../../../lib/inquiries/mailbox";

export const runtime = "nodejs";

/** Poll this endpoint from the deployment host every minute with `Authorization: Bearer $MAIL_SYNC_TOKEN`. */
export async function POST(request: Request) {
  if (!hasValidInternalBearerToken(request, process.env, "MAIL_SYNC_TOKEN"))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const result = await syncIncomingMail();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
