import { NextResponse } from "next/server";

import { hasValidInternalBearerToken } from "@/lib/auth/internal-token";
import { releaseExpiredWhatsAppLeases, runWhatsAppNotificationCycle } from "@/lib/whatsapp/notifications";

export const runtime = "nodejs";

/** Invoke periodically from the deployment host with `Authorization: Bearer $WHATSAPP_DISPATCH_TOKEN`. */
export async function POST(request: Request) {
  if (!hasValidInternalBearerToken(request, process.env, "WHATSAPP_DISPATCH_TOKEN")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  releaseExpiredWhatsAppLeases();
  const result = await runWhatsAppNotificationCycle();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
