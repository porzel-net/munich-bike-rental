import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "../../../lib/db/client";

import { getPublicBookingByToken, getPublicOfferByToken } from "../../../lib/bookings/public";

export const runtime = "nodejs";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const input = tokenSchema.safeParse({ token });
  if (!input.success) return NextResponse.json({ message: "Invalid offer link" }, { status: 400 });
  const database = getDatabase();
  const offer =
    getPublicOfferByToken(database, input.data.token) ?? getPublicBookingByToken(database, input.data.token);
  if (!offer) return NextResponse.json({ message: "Offer not found" }, { status: 404 });
  return NextResponse.json({ ok: true, offer }, { headers: { "Cache-Control": "no-store" } });
}

/** Direct confirmation is intentionally disabled; successful payment is required. */
export async function POST() {
  return NextResponse.json(
    { message: "Bitte die Zahlung über den Stripe-Checkout starten." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
