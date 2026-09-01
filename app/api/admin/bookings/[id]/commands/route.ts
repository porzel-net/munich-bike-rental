import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { isAdmin } from "@/lib/auth/session";
import {
  advanceBooking,
  acknowledgeBookingAttention,
  assignStripePaymentToBooking,
  cancelBooking,
  confirmManualBooking,
  correctJournalEntry,
  createOffer,
  deleteBookingPermanently,
  revokeOffer,
  recordRefund,
  setBookingEmailQuestionsResolved,
  setHistoricalBookingStatus,
} from "@/lib/bookings/service";
import { BookingCommandError } from "@/lib/bookings/errors";
import { dispatchNextOutboxMail } from "@/lib/bookings/outbox";
import { mailOutbox } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";
import { isValidIsoDate, isValidTime } from "@/lib/bookings/validation";
import { getStripeCheckoutSession } from "@/lib/stripe";
import { importStripeCheckoutPayment } from "@/lib/financial/stripe-payment";
import { refundStripeBookingPayment } from "@/lib/financial/stripe-refunds";

export const runtime = "nodejs";

const reason = z.string().trim().min(1).max(500);
const offerAccessories = z.object({
  needsPedals: z.boolean(),
  pedalType: z.string().nullable(),
  needsComputerMount: z.boolean(),
  computerMountType: z.string().nullable(),
  needsHelmet: z.boolean(),
  needsClothing: z.boolean(),
  needsBikepackingBag: z.boolean().default(false),
  needsGlasses: z.boolean().default(false),
  bottleHolderIncluded: z.boolean().default(true),
  repairKitIncluded: z.boolean().default(true),
  insuranceProtectionSelected: z.boolean().optional(),
});
const commandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("delete_permanently") }),
  z.object({
    command: z.literal("send_offer"),
    assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
    accessoriesByRequestedItem: z.record(z.string(), offerAccessories).optional(),
    isStudent: z.boolean().optional(),
    alternative: z.boolean().optional(),
    reason: z.string().trim().max(500).optional(),
    alternativeReason: z.string().trim().max(1000).optional(),
    personalMessage: z.string().trim().max(2000).optional(),
    sendMail: z.boolean().optional(),
    customTotalCents: z.number().int().min(0).optional(),
    periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum").optional(),
    periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum").optional(),
    pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit").optional(),
    dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit").optional(),
  }),
  z.object({
    command: z.literal("cancel"),
    cancellationFeeCents: z.number().int().min(0),
    reason,
    personalMessage: z.string().trim().max(2000).optional(),
    sendMail: z.boolean().optional(),
    cancellationPeriod: z.enum(["more_than_7_days", "between_7_days_and_24_hours", "less_than_24_hours"]),
    dueAt: z.string().datetime().optional(),
    stripeRefundAmountCents: z.number().int().positive().optional(),
    stripeRefundIdempotencyKey: z.string().uuid().optional(),
  }),
  z.object({
    command: z.literal("refund"),
    amountCents: z.number().int().positive(),
    bookedAt: z.string().refine(isValidIsoDate, "Ungültiges Erstattungsdatum"),
    financialAccountId: z.number().int().positive(),
    reason,
    idempotencyKey: z.string().uuid(),
  }),
  z.object({
    command: z.literal("stripe_refund"),
    amountCents: z.number().int().positive(),
    reason,
    idempotencyKey: z.string().uuid(),
  }),
  z.object({ command: z.literal("correct_journal"), entryId: z.number().int().positive(), reason }),
  z.object({
    command: z.literal("reject"),
    reason,
    personalMessage: z.string().trim().max(2000).optional(),
    sendMail: z.boolean().optional(),
  }),
  z.object({ command: z.literal("expire"), reason: z.string().trim().max(500).optional() }),
  z.object({ command: z.literal("revoke_offer"), reason: z.string().trim().max(500).optional() }),
  z.object({
    command: z.literal("check_out"),
    reason: z.string().trim().max(500).optional(),
    sendMail: z.boolean().optional(),
  }),
  z.object({ command: z.literal("complete"), reason: z.string().trim().max(500).optional() }),
  z.object({
    command: z.literal("assign_stripe_payment"),
    offerId: z.number().int().positive(),
    sessionId: z.string().trim().min(10).max(200),
    sendMail: z.boolean().optional(),
  }),
  z.object({
    command: z.literal("set_historical_status"),
    status: z.enum([
      "inquiry_received",
      "offer_sent",
      "confirmed",
      "checked_out",
      "completed",
      "rejected",
      "cancelled",
      "expired",
    ]),
    reason: z.string().trim().max(500).optional(),
    details: z
      .object({
        periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
        periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
        pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
        dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
        quotedTotalCents: z.number().int().min(0),
        assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
        invoiceNumber: z.string().trim().max(32).optional(),
        reason: z.string().trim().max(500).optional(),
      })
      .optional(),
  }),
  z.object({
    command: z.literal("confirm_manual_booking"),
    periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
    periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
    pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
    dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
    quotedTotalCents: z.number().int().min(0),
    assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
  }),
  z.object({
    command: z.literal("set_email_questions_resolved"),
    resolved: z.boolean(),
  }),
  z.object({ command: z.literal("acknowledge_booking_attention") }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = commandSchema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success)
    return NextResponse.json(
      {
        message:
          "Die Aktion ist unvollständig oder enthält ungültige Daten. Prüfe die Eingaben und versuche es erneut.",
      },
      { status: 400 },
    );
  if (
    input.data.command === "cancel" &&
    input.data.stripeRefundAmountCents !== undefined &&
    !input.data.stripeRefundIdempotencyKey
  ) {
    return NextResponse.json(
      { message: "Für eine Stripe-Erstattung bei der Stornierung ist ein Idempotenzschlüssel erforderlich." },
      { status: 400 },
    );
  }
  if (["correct_journal", "delete_permanently"].includes(input.data.command) && !isAdmin(command.user)) {
    return NextResponse.json({ message: "Für diese Aktion brauchst du Administratorrechte." }, { status: 403 });
  }
  try {
    switch (input.data.command) {
      case "delete_permanently":
        deleteBookingPermanently(command.db, id);
        return NextResponse.json({ ok: true, deleted: true });
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
          isStudent: input.data.isStudent,
          alternative: input.data.alternative,
          reason: input.data.reason,
          alternativeReason: input.data.alternativeReason,
          personalMessage: input.data.personalMessage,
          sendMail: input.data.sendMail,
          customTotalCents: input.data.customTotalCents,
          periodFrom: input.data.periodFrom,
          periodTo: input.data.periodTo,
          pickupTime: input.data.pickupTime,
          dropoffTime: input.data.dropoffTime,
          actorUserId: command.user.id,
        });
        const mailId = command.db
          .select({ id: mailOutbox.id })
          .from(mailOutbox)
          .where(and(eq(mailOutbox.bookingId, id), eq(mailOutbox.offerId, createdOffer.offerId)))
          .get()?.id;
        const mailResult = mailId ? await dispatchNextOutboxMail(command.db, mailId) : null;
        if (mailResult?.status === "failed") {
          const mailError = mailId
            ? command.db
                .select({ lastError: mailOutbox.lastError })
                .from(mailOutbox)
                .where(eq(mailOutbox.id, mailId))
                .get()?.lastError
            : null;
          return NextResponse.json(
            {
              message: `Das Angebot wurde angelegt, aber die Angebotsmail konnte nicht versendet werden.${mailError ? ` SMTP-Fehler: ${mailError}` : ""}`,
              mailStatus: mailResult.status,
            },
            { status: 502 },
          );
        }
        return NextResponse.json({ ...createdOffer, mailStatus: mailResult?.status ?? null });
      }
      case "cancel": {
        const mailId = cancelBooking(command.db, {
          bookingId: id,
          cancellationFeeCents: input.data.cancellationFeeCents,
          reason: input.data.reason,
          personalMessage: input.data.personalMessage,
          cancellationPeriod: input.data.cancellationPeriod,
          dueAt: input.data.dueAt ? new Date(input.data.dueAt) : null,
          actorUserId: command.user.id,
          sendMail: input.data.sendMail,
        });
        let stripeRefund = null;
        let stripeRefundError: string | null = null;
        if (input.data.stripeRefundAmountCents) {
          try {
            stripeRefund = await refundStripeBookingPayment(command.db, {
              bookingId: id,
              amountCents: input.data.stripeRefundAmountCents,
              reason: `Stripe-Erstattung bei Stornierung: ${input.data.reason}`,
              actorUserId: command.user.id,
              idempotencyKey: input.data.stripeRefundIdempotencyKey ?? "",
            });
          } catch (error) {
            stripeRefundError = error instanceof Error ? error.message : "Die Stripe-Erstattung ist noch offen.";
            console.error("Booking cancelled but Stripe refund is pending", { bookingId: id, error });
          }
        }
        const mailResult = mailId ? await dispatchNextOutboxMail(command.db, mailId) : null;
        if (mailResult?.status === "failed")
          return NextResponse.json(
            {
              message: stripeRefundError
                ? "Die Buchung wurde storniert, aber Rückerstattung und Stornomail sind noch offen."
                : "Die Buchung wurde storniert, aber die Stornomail konnte nicht versendet werden.",
              mailStatus: mailResult.status,
              stripeRefundPending: Boolean(stripeRefundError),
            },
            { status: stripeRefundError ? 202 : 502 },
          );
        if (stripeRefundError)
          return NextResponse.json(
            {
              ok: true,
              stripeRefund: null,
              stripeRefundPending: true,
              message: "Die Buchung wurde storniert. Die Stripe-Erstattung muss noch erneut ausgeführt werden.",
            },
            { status: 202 },
          );
        return NextResponse.json({ ok: true, stripeRefund, stripeRefundPending: false });
      }
      case "refund":
        recordRefund(command.db, {
          bookingId: id,
          amountCents: input.data.amountCents,
          bookedAt: input.data.bookedAt,
          financialAccountId: input.data.financialAccountId,
          reason: input.data.reason,
          idempotencyKey: input.data.idempotencyKey,
          actorUserId: command.user.id,
        });
        break;
      case "stripe_refund":
        return NextResponse.json({
          ok: true,
          stripeRefund: await refundStripeBookingPayment(command.db, {
            bookingId: id,
            amountCents: input.data.amountCents,
            reason: input.data.reason,
            actorUserId: command.user.id,
            idempotencyKey: input.data.idempotencyKey,
          }),
        });
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
            input.data.sendMail,
          );
          const mailResult = mailId ? await dispatchNextOutboxMail(command.db, mailId) : null;
          if (mailResult?.status === "failed")
            return NextResponse.json(
              {
                message: "Die Anfrage wurde abgelehnt, aber die Absagemail konnte nicht versendet werden.",
                mailStatus: mailResult.status,
              },
              { status: 502 },
            );
        }
        break;
      case "expire":
        advanceBooking(command.db, id, "expired", command.user.id, input.data.reason);
        break;
      case "revoke_offer":
        revokeOffer(command.db, { bookingId: id, actorUserId: command.user.id, reason: input.data.reason });
        break;
      case "check_out":
        {
          const mailId =
            input.data.sendMail === undefined
              ? advanceBooking(command.db, id, "checked_out", command.user.id, input.data.reason)
              : advanceBooking(
                  command.db,
                  id,
                  "checked_out",
                  command.user.id,
                  input.data.reason,
                  undefined,
                  input.data.sendMail,
                );
          const mailResult = mailId ? await dispatchNextOutboxMail(command.db, mailId) : null;
          if (mailResult?.status === "failed")
            return NextResponse.json(
              {
                message: "Die Ausgabe wurde erfasst, aber die Feedback-Mail konnte nicht versendet werden.",
                mailStatus: mailResult.status,
              },
              { status: 502 },
            );
        }
        break;
      case "complete":
        advanceBooking(command.db, id, "completed", command.user.id, input.data.reason);
        break;
      case "assign_stripe_payment": {
        const session = await getStripeCheckoutSession(input.data.sessionId);
        const amountCents = session.amount_total;
        if (
          session.payment_status !== "paid" ||
          amountCents === null ||
          !Number.isSafeInteger(amountCents) ||
          session.metadata?.booking_id !== String(id) ||
          session.metadata?.booking_offer_id !== String(input.data.offerId) ||
          session.currency?.toLowerCase() !== "eur"
        )
          throw new BookingCommandError("Die ausgewählte Stripe-Zahlung ist noch nicht als bezahlt bestätigt.");
        const result = assignStripePaymentToBooking(command.db, {
          bookingId: id,
          offerId: input.data.offerId,
          amountCents,
          sessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent && typeof session.payment_intent === "object"
                ? session.payment_intent.id
                : null,
          metadata: {
            bookingId: session.metadata?.booking_id,
            bookingOfferId: session.metadata?.booking_offer_id,
            currency: session.currency,
          },
          actorUserId: command.user.id,
          sendMail: input.data.sendMail,
        });
        let accountingWarning: string | null = null;
        try {
          await importStripeCheckoutPayment(command.db, { sessionId: session.id, bookingId: id });
        } catch (error) {
          accountingWarning =
            error instanceof Error ? error.message : "Die Finanzbuchung konnte nicht importiert werden.";
          console.error("Manual Stripe payment accounting import failed", {
            bookingId: id,
            sessionId: session.id,
            error,
          });
        }
        const confirmationMailId =
          input.data.sendMail === false
            ? undefined
            : command.db
                .select({ id: mailOutbox.id })
                .from(mailOutbox)
                .where(
                  and(
                    eq(mailOutbox.bookingId, id),
                    eq(mailOutbox.kind, "booking_confirmed"),
                    eq(mailOutbox.status, "queued"),
                  ),
                )
                .get()?.id;
        const mailResult = confirmationMailId ? await dispatchNextOutboxMail(command.db, confirmationMailId) : null;
        if (mailResult?.status === "failed") {
          return NextResponse.json(
            {
              message: "Die Zahlung wurde zugeordnet, aber die Bestätigungsmail konnte nicht versendet werden.",
              mailStatus: mailResult.status,
            },
            { status: 502 },
          );
        }
        const unavailableAccessories = ("unavailableAccessories" in result && result.unavailableAccessories) || [];
        const accessoryWarning = unavailableAccessories.length
          ? `Folgendes Zubehör konnte nicht reserviert werden: ${unavailableAccessories.join(", ")}.`
          : null;
        return NextResponse.json({
          ok: true,
          ...result,
          accountingWarning,
          accessoryWarning,
          mailStatus: mailResult?.status ?? null,
        });
      }
      case "set_historical_status":
        setHistoricalBookingStatus(command.db, {
          bookingId: id,
          status: input.data.status,
          reason: input.data.reason,
          details: input.data.details
            ? {
                ...input.data.details,
                assetsByRequestedItem: Object.fromEntries(
                  Object.entries(input.data.details.assetsByRequestedItem).map(([key, value]) => [Number(key), value]),
                ),
              }
            : undefined,
          actorUserId: command.user.id,
        });
        break;
      case "confirm_manual_booking":
        confirmManualBooking(command.db, {
          bookingId: id,
          actorUserId: command.user.id,
          details: {
            periodFrom: input.data.periodFrom,
            periodTo: input.data.periodTo,
            pickupTime: input.data.pickupTime,
            dropoffTime: input.data.dropoffTime,
            quotedTotalCents: input.data.quotedTotalCents,
            assetsByRequestedItem: Object.fromEntries(
              Object.entries(input.data.assetsByRequestedItem).map(([key, value]) => [Number(key), value]),
            ),
          },
        });
        break;
      case "set_email_questions_resolved":
        setBookingEmailQuestionsResolved(command.db, {
          bookingId: id,
          resolved: input.data.resolved,
          actorUserId: command.user.id,
        });
        break;
      case "acknowledge_booking_attention":
        acknowledgeBookingAttention(command.db, { bookingId: id, actorUserId: command.user.id });
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Die Aktion für diese Buchung konnte nicht ausgeführt werden. Prüfe den aktuellen Buchungsstatus und versuche es erneut.",
      },
      { status: 409 },
    );
  }
}
