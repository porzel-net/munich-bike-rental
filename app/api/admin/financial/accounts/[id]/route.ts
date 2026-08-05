import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema";

export const runtime = "nodejs";

const schema = z.object({
  openingBalanceCents: z.number().int().safe(),
  openingBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const base = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  const session = await getServerSession();
  if (
    request.headers.get("origin") !== new URL(base).origin ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !isAdmin(session.user)
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || id <= 0 || !input.success)
    return NextResponse.json({ message: "Ungültige Kontodaten" }, { status: 400 });
  const account = getDatabase()
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(eq(financialAccounts.id, id))
    .get();
  if (!account) return NextResponse.json({ message: "Finanzkonto nicht gefunden" }, { status: 404 });
  getDatabase()
    .update(financialAccounts)
    .set({ ...input.data, updatedAt: new Date() })
    .where(eq(financialAccounts.id, id))
    .run();
  return NextResponse.json({ ok: true });
}
