import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, isAdmin } from "../../../../../lib/auth/session";
import { getDatabase } from "../../../../../lib/db/client";
import { accountingExpenses } from "../../../../../lib/db/schema";

export const runtime = "nodejs";

const expenseSchema = z.object({
  description: z.string().trim().min(1).max(2_000),
  payeeName: z.string().trim().min(1).max(200),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depreciationDurationMonths: z.number().int().min(1).max(1_200).nullable(),
  sumCents: z.number().int().min(0).max(1_000_000_000),
});

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !isAdmin(session.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const input = expenseSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Ungültige Aufwandsdaten" }, { status: 400 });

  const now = new Date();
  const expense = getDatabase()
    .insert(accountingExpenses)
    .values({
      ...input.data,
      createdBy: session.user.name,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return NextResponse.json({ expense }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
