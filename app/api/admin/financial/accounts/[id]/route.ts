import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema";
import { BookingCommandError } from "@/lib/bookings/errors";
import { setFinancialAccountStatus, updateOpeningBalance } from "@/lib/financial/accounts";
import { isValidIsoDate } from "@/lib/bookings/validation";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const openingBalanceSchema = z.object({
  openingBalanceCents: z.number().int().safe(),
  openingBalanceDate: z.string().refine(isValidIsoDate, "Ungültiges Datum des Anfangsbestands"),
});
const updateSchema = z.union([openingBalanceSchema, z.object({ status: z.enum(["active", "archived"]) })]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      {
        message:
          "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung, dieses Finanzkonto zu ändern.",
      },
      { status: 401 },
    );
  const id = Number((await context.params).id);
  const input = updateSchema.safeParse(await readBoundedJson(request));
  if (!Number.isInteger(id) || id <= 0 || !input.success)
    return NextResponse.json(
      { message: "Die Kontodaten sind ungültig. Prüfe Kontostatus oder Anfangsbestand inklusive Datum." },
      { status: 400 },
    );
  const account = getDatabase()
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(eq(financialAccounts.id, id))
    .get();
  if (!account)
    return NextResponse.json(
      { message: "Das Finanzkonto wurde nicht gefunden. Aktualisiere die Kontenliste und versuche es erneut." },
      { status: 404 },
    );
  try {
    if ("status" in input.data) {
      return NextResponse.json(
        setFinancialAccountStatus(getDatabase(), {
          accountId: id,
          status: input.data.status,
          actorUserId: session.user.id,
        }),
      );
    }
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
          error instanceof BookingCommandError
            ? error.message
            : "Der Anfangsbestand konnte nicht gespeichert werden. Prüfe Betrag, Datum und Kontostatus.",
      },
      { status: 409 },
    );
  }
}
