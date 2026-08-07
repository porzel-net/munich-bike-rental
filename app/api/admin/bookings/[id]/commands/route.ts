import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { isAdmin } from "@/lib/auth/session";
import {
  advanceBooking,
  cancelBooking,
  correctJournalEntry,
  createOffer,
  recordPayment,
  recordRefund,
} from "@/lib/bookings/service";
import { BookingCommandError } from "@/lib/bookings/errors";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";
import { mailOutbox } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const reason = z.string().trim().min(1).max(500);
const offerAccessories = z.object({
  needsPedals: z.boolean(),
  pedalType: z.string().nullable(),
  needsComputerMount: z.boolean(),
  computerMountType: z.string().nullable(),
  needsHelmet: z.boolean(),
  needsClothing: z.boolean(),
});
const commandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("send_offer"),
    assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
    accessoriesByRequestedItem: z.record(z.string(), offerAccessories).optional(),
    alternative: z.boolean().optional(),
    reason: z.string().trim().max(500).optional(),
    alternativeReason: z.string().trim().max(1000).optional(),
    personalMessage: z.string().trim().max(2000).optional(),
  }),
  z.object({
    command: z.literal("cancel"),
    cancellationFeeCents: z.number().int().min(0),
    reason,
    dueAt: z.string().datetime().optional(),
  }),
  z.object({
    command: z.literal("payment"),
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, "Betrag darf nicht 0 sein"),
    reason,
    idempotencyKey: z.string().uuid(),
  }),
  z.object({
    command: z.literal("refund"),
    amountCents: z.number().int().positive(),
    reason,
    idempotencyKey: z.string().uuid(),
  }),
  z.object({ command: z.literal("correct_journal"), entryId: z.number().int().positive(), reason }),
  z.object({ command: z.literal("reject"), reason, personalMessage: z.string().trim().max(2000).optional() }),
  z.object({ command: z.literal("expire"), reason: z.string().trim().max(500).optional() }),
  z.object({ command: z.literal("check_out"), reason: z.string().trim().max(500).optional() }),
  z.object({ command: z.literal("complete"), reason: z.string().trim().max(500).optional() }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = commandSchema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success) return NextResponse.json({ message: "Invalid command" }, { status: 400 });
  if (input.data.command === "correct_journal" && !isAdmin(command.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  try {
    switch (input.data.command) {
      case "send_offer": {
        const createdOffer = createOffer(command.db, {
          bookingId: id,
          assetsByRequestedItem: Object.fromEntries(
            Object.entries(input.data.assetsByRequestedItem).map(([key, value]) => [Number(key), value]),
          ),
          accessoriesByRequestedItem: input.data.accessoriesByRequestedItem
            ? Object.fromEntries(
                Object.entries(input.data.accessoriesByRequestedItem).map(([key, value]) => [Number(key), value]),
              )
            : undefined,
          alternative: input.data.alternative,
          reason: input.data.reason,
          alternativeReason: input.data.alternativeReason,
          personalMessage: input.data.personalMessage,
          actorUserId: command.user.id,
        });
        const mailId = command.db
          .select({ id: mailOutbox.id })
          .from(mailOutbox)
          .where(and(eq(mailOutbox.bookingId, id), eq(mailOutbox.offerId, createdOffer.offerId)))
          .get()?.id;
        if (mailId) await dispatchNextOutboxMail(command.db, mailId);
        return NextResponse.json(createdOffer);
      }
      case "cancel": {
        const mailId = cancelBooking(command.db, {
          bookingId: id,
          cancellationFeeCents: input.data.cancellationFeeCents,
          reason: input.data.reason,
          dueAt: input.data.dueAt ? new Date(input.data.dueAt) : null,
          actorUserId: command.user.id,
        });
        if (mailId) await dispatchNextOutboxMail(command.db, mailId);
        break;
      }
      case "payment":
        recordPayment(command.db, {
          bookingId: id,
          amountCents: input.data.amountCents,
          reason: input.data.reason,
          idempotencyKey: input.data.idempotencyKey,
          actorUserId: command.user.id,
        });
        break;
      case "refund":
        recordRefund(command.db, {
          bookingId: id,
          amountCents: input.data.amountCents,
          reason: input.data.reason,
          idempotencyKey: input.data.idempotencyKey,
          actorUserId: command.user.id,
        });
        break;
      case "correct_journal":
        correctJournalEntry(command.db, {
          bookingId: id,
          entryId: input.data.entryId,
          reason: input.data.reason,
          actorUserId: command.user.id,
        });
        break;
      case "reject":
        {
          const mailId = advanceBooking(
            command.db,
            id,
            "rejected",
            command.user.id,
            input.data.reason,
            input.data.personalMessage,
          );
          if (mailId) await dispatchNextOutboxMail(command.db, mailId);
        }
        break;
      case "expire":
        advanceBooking(command.db, id, "expired", command.user.id, input.data.reason);
        break;
      case "check_out":
        advanceBooking(command.db, id, "checked_out", command.user.id, input.data.reason);
        break;
      case "complete":
        advanceBooking(command.db, id, "completed", command.user.id, input.data.reason);
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Command failed" },
      { status: 409 },
    );
  }
}
