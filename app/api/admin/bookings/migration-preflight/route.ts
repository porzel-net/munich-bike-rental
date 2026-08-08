import { NextResponse } from "next/server";

import { canUseAdminApiAsAdmin, getServerSession } from "../../../../../lib/auth/session";
import { getBookingMigrationPreflight } from "../../../../../lib/bookings/preflight";
import { getDatabase } from "../../../../../lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession();
  if (!session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getBookingMigrationPreflight(getDatabase()), { headers: { "Cache-Control": "no-store" } });
}
