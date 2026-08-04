import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAdmin, getServerSession, isAdmin } from "../../../../../lib/auth/session";
import { BookingCommandError, recordExpense } from "../../../../../lib/bookings/service";
import { getDatabase } from "../../../../../lib/db/client";
import { journalEntries, journalLines } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const schema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  bookingId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  const session = await getServerSession();
  const input = schema.safeParse(await request.json().catch(() => null));
  if (
    origin !== new URL(base).origin ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !isAdmin(session.user) ||
    !input.success
  )
    return NextResponse.json({ message: "Invalid expense" }, { status: 400 });
  try {
    const db = getDatabase();
    const entryId = recordExpense(db, { ...input.data, actorUserId: session.user.id });
    const entry = db.select().from(journalEntries).where(eq(journalEntries.id, entryId)).get();
    const lines = db.select().from(journalLines).where(eq(journalLines.entryId, entryId)).all();
    if (!entry) return NextResponse.json({ message: "Expense entry not found" }, { status: 500 });
    return NextResponse.json({
      ok: true,
      entry: {
        ...entry,
        orderNumber: null,
        customerName: null,
        lines,
        displayAmountCents: -input.data.amountCents,
        displayType: "expense" as const,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Expense failed" },
      { status: 409 },
    );
  }
}
