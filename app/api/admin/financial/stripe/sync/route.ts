import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAdmin, getServerSession, isAdmin } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { syncStripeCheckoutPayments } from "../../../../../../lib/financial/stripe-sync";

export const runtime = "nodejs";

const schema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

function authorized(request: Request, session: Awaited<ReturnType<typeof getServerSession>>) {
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return (
    request.headers.get("origin") === new URL(base).origin &&
    session &&
    session.user.twoFactorEnabled &&
    canAccessAdmin(session.user) &&
    isAdmin(session.user)
  );
}

function unixSeconds(value: string, endOfDay = false) {
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Math.floor(date.getTime() / 1_000);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!authorized(request, session)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const input = schema.safeParse(await request.json().catch(() => ({})));
  if (!input.success)
    return NextResponse.json({ message: "Ungültiger Stripe-Synchronisationszeitraum." }, { status: 400 });
  if (input.data.dateFrom && input.data.dateTo && input.data.dateFrom > input.data.dateTo) {
    return NextResponse.json({ message: "Der Start darf nicht nach dem Ende liegen." }, { status: 400 });
  }

  try {
    const result = await syncStripeCheckoutPayments(getDatabase(), {
      createdGte: input.data.dateFrom ? unixSeconds(input.data.dateFrom) : undefined,
      createdLte: input.data.dateTo ? unixSeconds(input.data.dateTo, true) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Stripe-Synchronisation fehlgeschlagen." },
      { status: 502 },
    );
  }
}
