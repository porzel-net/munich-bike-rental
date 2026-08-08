import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "../../../../../lib/auth/session";
import { importLegacyInventoryIntoBookingInventory } from "../../../../../lib/bookings/inventory-bootstrap";
import { getDatabase } from "../../../../../lib/db/client";
import { seedRentalInventoryIfEmpty } from "../../../../../lib/inventory/seed";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  seedRentalInventoryIfEmpty(db);
  return NextResponse.json({ ok: true, ...importLegacyInventoryIntoBookingInventory(db) });
}
