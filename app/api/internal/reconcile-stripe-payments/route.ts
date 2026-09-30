import { NextResponse } from "next/server";

import { hasValidInternalBearerToken } from "@/lib/auth/internal-token";
import { getDatabase } from "@/lib/db/client";
import { syncStripeCheckoutPayments } from "@/lib/financial/stripe-sync";
import { runWhatsAppNotificationCycle } from "@/lib/whatsapp/notifications";

export const runtime = "nodejs";

/**
 * Run every five minutes from the deployment host. It scans every completed,
 * paid Stripe Checkout Session so a missed webhook cannot leave money without
 * a confirmed booking. New findings are immediately added to the WhatsApp
 * outbox rather than waiting for the next notification cycle.
 */
export async function POST(request: Request) {
  if (!hasValidInternalBearerToken(request, process.env, "STRIPE_RECONCILIATION_TOKEN")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const database = getDatabase();
    const stripe = await syncStripeCheckoutPayments(database);
    const notifications = await runWhatsAppNotificationCycle(database);
    return NextResponse.json({ ok: true, stripe, notifications }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stripe payment reconciliation failed", {
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    return NextResponse.json(
      { message: "Der Stripe-Zahlungsabgleich konnte nicht abgeschlossen werden." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
