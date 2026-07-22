import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, isAdmin } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { accountingRevenuePayments, accountingRevenues } from "../../../../../../lib/db/schema";

export const runtime = "nodejs";

const revenueUpdateSchema = z.object({
  payments: z
    .array(
      z.object({
        amountCents: z.number().int().min(1).max(1_000_000_000),
        receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .max(100),
  notes: z.string().trim().max(5_000),
});

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !isAdmin(session.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const revenueId = Number((await params).id);
  if (!Number.isSafeInteger(revenueId) || revenueId < 1) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const input = revenueUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Ungültige Zahlungsdaten" }, { status: 400 });

  const db = getDatabase();
  const revenue = db
    .select({ id: accountingRevenues.id, amountCents: accountingRevenues.amountCents })
    .from(accountingRevenues)
    .where(eq(accountingRevenues.id, revenueId))
    .get();
  if (!revenue) return NextResponse.json({ message: "Ertrag nicht gefunden" }, { status: 404 });
  const paidAmountCents = input.data.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paidAmountCents > revenue.amountCents) {
    return NextResponse.json({ message: "Der bezahlte Betrag darf den Gesamtbetrag nicht überschreiten." }, { status: 400 });
  }

  const updatedAt = new Date();
  const updated = db.transaction((transaction) => {
    const savedRevenue = transaction
      .update(accountingRevenues)
      .set({
        paidAmountCents,
        paymentReceivedAt: input.data.payments.at(-1)?.receivedAt ?? null,
        notes: input.data.notes,
        updatedAt,
      })
      .where(eq(accountingRevenues.id, revenueId))
      .returning()
      .get();

    transaction.delete(accountingRevenuePayments).where(eq(accountingRevenuePayments.revenueId, revenueId)).run();
    if (input.data.payments.length > 0) {
      transaction
        .insert(accountingRevenuePayments)
        .values(
          input.data.payments.map((payment) => ({
            revenueId,
            amountCents: payment.amountCents,
            receivedAt: payment.receivedAt,
            createdAt: updatedAt,
          })),
        )
        .run();
    }
    return savedRevenue;
  });

  return NextResponse.json({ revenue: { ...updated, payments: input.data.payments } }, { headers: { "Cache-Control": "no-store" } });
}
