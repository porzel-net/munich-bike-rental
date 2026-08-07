import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessAdmin, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema";
import { BookingCommandError } from "@/lib/bookings/errors";
import { updateOpeningBalance } from "@/lib/financial/accounts";
import { isValidIsoDate } from "@/lib/bookings/validation";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  openingBalanceCents: z.number().int().safe(),
  openingBalanceDate: z.string().refine(isValidIsoDate, "Ungültiges Datum des Anfangsbestands"),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (
    !hasTrustedOrigin(request) ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
    !isAdmin(session.user)
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  if (!Number.isInteger(id) || id <= 0 || !input.success)
    return NextResponse.json({ message: "Ungültige Kontodaten" }, { status: 400 });
  const account = getDatabase()
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(eq(financialAccounts.id, id))
    .get();
  if (!account) return NextResponse.json({ message: "Finanzkonto nicht gefunden" }, { status: 404 });
  try {
    return NextResponse.json(
      updateOpeningBalance(getDatabase(), {
        accountId: id,
        actorUserId: session.user.id,
        ...input.data,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError ? error.message : "Anfangsbestand konnte nicht gespeichert werden.",
      },
      { status: 409 },
    );
  }
}
