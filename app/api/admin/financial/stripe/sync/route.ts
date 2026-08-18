import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import { syncStripeCheckoutPayments } from "../../../../../../lib/financial/stripe-sync";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

function authorized(request: Request, session: Awaited<ReturnType<typeof getServerSession>>) {
  return hasTrustedOrigin(request) && session && canUseAdminApiAsAdmin(session.user);
}

function unixSeconds(value: string, endOfDay = false) {
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Math.floor(date.getTime() / 1_000);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!authorized(request, session))
    return NextResponse.json(
      {
        message:
          "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung für die Stripe-Synchronisation.",
      },
      { status: 401 },
    );

  const input = schema.safeParse((await readBoundedJson(request)) ?? {});
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
    console.error("Stripe synchronization failed", {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    return NextResponse.json(
      {
        message:
          "Die Stripe-Synchronisation konnte nicht abgeschlossen werden. Prüfe Stripe-Zugang, Zeitraum und Serververbindung.",
      },
      { status: 502 },
    );
  }
}
