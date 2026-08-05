import { NextResponse } from "next/server";
import { z } from "zod";

import { BookingCommandError } from "@/lib/bookings/errors";
import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { ignoreFinancialTransaction, postFinancialTransaction } from "@/lib/financial/reconciliation";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("post"),
    categoryId: z.number().int().positive(),
    destinationAccountId: z.number().int().positive().optional(),
    note: z.string().trim().min(1).max(1000),
  }),
  z.object({ action: z.literal("ignore"), reason: z.string().trim().min(1).max(1000) }),
]);

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!authorized(request, session)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const transactionId = Number((await context.params).id);
  if (!Number.isInteger(transactionId) || transactionId <= 0)
    return NextResponse.json({ message: "Ungültige Transaktion" }, { status: 400 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Ungültige Zuordnung" }, { status: 400 });

  try {
    const db = getDatabase();
    const result =
      input.data.action === "post"
        ? postFinancialTransaction(db, { transactionId, actorUserId: session.user.id, ...input.data })
        : ignoreFinancialTransaction(db, { transactionId, actorUserId: session.user.id, reason: input.data.reason });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof BookingCommandError ? error.message : "Transaktion konnte nicht verarbeitet werden.",
      },
      { status: 409 },
    );
  }
}
