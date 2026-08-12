import { NextResponse } from "next/server";

import { getStartupCheckReport } from "@/lib/startup-check";

export const runtime = "nodejs";

export async function GET() {
  const startup = getStartupCheckReport();
  const ok = startup?.ok ?? true;
  return NextResponse.json(
    { ok },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
