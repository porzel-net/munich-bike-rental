import { NextResponse } from "next/server";
import { z } from "zod";

import { BookingCommandError } from "@/lib/bookings/errors";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import {
  assignNevloTransactionToBooking,
  ignoreFinancialTransaction,
  postFinancialTransaction,
} from "@/lib/financial/reconciliation";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("post"),
    categoryId: z.number().int().positive(),
    bookingId: z.number().int().positive().optional(),
    destinationAccountId: z.number().int().positive().optional(),
    note: z.string().trim().min(1).max(1000),
    businessMeal: z
      .object({
        privateShareCents: z.number().int().nonnegative(),
        inputVatCents: z.number().int().nonnegative().optional(),
      })
      .optional(),
    asset: z
      .object({
        name: z.string().trim().min(1).max(200),
        assetType: z.enum(["bike", "equipment", "other"]),
        serialNumber: z.string().trim().max(200).optional(),
        acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        inServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        acquisitionCostCents: z.number().int().positive(),
        inputVatCents: z.number().int().nonnegative().optional(),
        usefulLifeMonths: z.number().int().positive(),
        residualValueCents: z.number().int().nonnegative().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .optional(),
  }),
  z.object({ action: z.literal("ignore"), reason: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("assign_booking"), bookingId: z.number().int().positive() }),
]);

function authorized(request: Request, session: Awaited<ReturnType<typeof getServerSession>>) {
  return hasTrustedOrigin(request) && session && canUseAdminApiAsAdmin(session.user);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!authorized(request, session)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const transactionId = Number((await context.params).id);
  if (!Number.isInteger(transactionId) || transactionId <= 0)
    return NextResponse.json({ message: "Ungültige Transaktion" }, { status: 400 });
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success) return NextResponse.json({ message: "Ungültige Zuordnung" }, { status: 400 });

  try {
    const db = getDatabase();
    const result =
      input.data.action === "post"
        ? postFinancialTransaction(db, { transactionId, actorUserId: session.user.id, ...input.data })
        : input.data.action === "ignore"
          ? ignoreFinancialTransaction(db, { transactionId, actorUserId: session.user.id, reason: input.data.reason })
          : assignNevloTransactionToBooking(db, {
              transactionId,
              bookingId: input.data.bookingId,
              actorUserId: session.user.id,
            });
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
