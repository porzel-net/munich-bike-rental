import { NextResponse } from "next/server";

import { canAccessAdmin, getServerSession, isAdmin } from "../../../../../lib/auth/session";
import { importLegacyInventoryIntoBookingInventory } from "../../../../../lib/bookings/inventory-bootstrap";
import { getDatabase } from "../../../../../lib/db/client";
import { seedRentalInventoryIfEmpty } from "../../../../../lib/inventory/seed";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  const session = await getServerSession();
  if (request.headers.get("origin") !== new URL(base).origin || !session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user) || !isAdmin(session.user)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  seedRentalInventoryIfEmpty(db);
  return NextResponse.json({ ok: true, ...importLegacyInventoryIntoBookingInventory(db) });
}
