import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { NevloApiError, NevloConfigurationError } from "../../../../../../lib/nevlo";
import { syncNevloTransactions } from "../../../../../../lib/financial/nevlo-sync";
import { isValidIsoDate } from "../../../../../../lib/bookings/validation";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z
  .object({
    accountId: z.string().trim().min(1).optional(),
    dateFrom: z.string().trim().refine(isValidIsoDate, "Ungültiges Startdatum").optional(),
    dateTo: z.string().trim().refine(isValidIsoDate, "Ungültiges Enddatum").optional(),
  })
  .refine((input) => !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo, {
    message: "Der Start darf nicht nach dem Ende liegen.",
    path: ["dateTo"],
  });

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const input = schema.safeParse((await readBoundedJson(request)) ?? {});
  if (!input.success)
    return NextResponse.json(
      { message: input.error.issues[0]?.message ?? "Ungültige Synchronisationsdaten." },
      { status: 400 },
    );
  try {
    const result = await syncNevloTransactions(getDatabase(), input.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof NevloConfigurationError ? 503 : error instanceof NevloApiError ? 502 : 409;
    console.error("Nevlo synchronization failed", {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    return NextResponse.json({ message: "Nevlo-Synchronisation fehlgeschlagen." }, { status });
  }
}
