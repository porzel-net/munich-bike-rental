import { NextResponse } from "next/server";

import { createStripeTestCheckoutSession, StripeConfigurationError } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await createStripeTestCheckoutSession(request.url);
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof StripeConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Die Stripe-Testzahlung konnte nicht gestartet werden.";

    return NextResponse.json({ error: message }, { status: error instanceof StripeConfigurationError ? 503 : 502 });
  }
}
