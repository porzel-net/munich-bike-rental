import { NextResponse } from "next/server";

import { hasValidInternalBearerToken } from "@/lib/auth/internal-token";
import { getDatabase } from "@/lib/db/client";
import { berlinDateKey } from "@/lib/datetime";
import { postDueFixedAssetDepreciation } from "@/lib/financial/fixed-assets";

export const runtime = "nodejs";

/** Invoke once per day from the deployment host with `FIXED_ASSET_DEPRECIATION_TOKEN`. */
export async function POST(request: Request) {
  if (!hasValidInternalBearerToken(request, process.env, "FIXED_ASSET_DEPRECIATION_TOKEN")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const result = postDueFixedAssetDepreciation(getDatabase(), {
    throughMonth: berlinDateKey().slice(0, 7),
    actorUserId: null,
  });
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
