import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { authUser, bookingEvents, bookings, mailOutbox, type BookingStatus } from "../db/schema";

import { BookingCommandError } from "./errors";
import type { RenderedMail } from "./messages";

/**
 * The booking lifecycle is deliberately kept in one table. Commands may add
 * side effects around a transition, but they must never invent their own
 * partial transition rules.
 */
const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  inquiry_received: ["offer_sent", "rejected"],
  offer_sent: ["confirmed", "expired", "cancelled"],
  confirmed: ["checked_out", "cancelled"],
  checked_out: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: ["offer_sent", "confirmed"],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (!canTransition(from, to)) throw new BookingCommandError(`Transition ${from} → ${to} is not allowed`);
}

export function now() {
  return new Date();
}

export function assertBookingHasAssignee(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  if (
    !booking.assignedUserId ||
    !db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, booking.assignedUserId)).get()
  )
    throw new BookingCommandError("Für diese Buchung muss zuerst ein Sachbearbeiter eingetragen werden");
}

function getBookingAssignee(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return booking.assignedUserId
    ? (db
        .select({ privateAddress: authUser.privateAddress, whatsappPhone: authUser.whatsappPhone })
        .from(authUser)
        .where(eq(authUser.id, booking.assignedUserId))
        .get() ?? undefined)
    : undefined;
}

export function getBookingPickupAddress(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return getBookingAssignee(db, booking)?.privateAddress ?? undefined;
}

export function getBookingContactPhone(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return getBookingAssignee(db, booking)?.whatsappPhone?.trim() || undefined;
}

export function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/).filter(Boolean)[0] ?? "Your Bike Rental";
}

export function queueCustomerMail(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  input: {
    kind: string;
    mail: RenderedMail;
    idempotencyKey?: string;
  },
) {
  return (
    db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: input.idempotencyKey ?? `booking:${booking.id}:${input.kind}`,
        kind: input.kind,
        locale: booking.communicationLocale,
        recipient: booking.customerEmail,
        subject: input.mail.subject,
        plainText: input.mail.text,
        html: input.mail.html,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now(),
        createdAt: now(),
      })
      .onConflictDoNothing()
      .returning({ id: mailOutbox.id })
      .get()?.id ?? null
  );
}

export function event(
  db: AppDatabase,
  bookingId: number,
  type: string,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus | null,
  actorUserId?: string | null,
  reason = "",
  payload: unknown = {},
  occurredAt = now(),
) {
  db.insert(bookingEvents)
    .values({
      bookingId,
      eventType: type,
      fromStatus,
      toStatus,
      actorUserId: actorUserId ?? null,
      reason,
      payloadJson: JSON.stringify(payload),
      occurredAt,
    })
    .run();
}

export function transition(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  target: BookingStatus,
  type: string,
  actorUserId?: string | null,
  reason = "",
  payload: unknown = {},
) {
  assertTransition(booking.status, target);
  db.update(bookings)
    .set({ status: target, version: booking.version + 1, updatedAt: now() })
    .where(eq(bookings.id, booking.id))
    .run();
  event(db, booking.id, type, booking.status, target, actorUserId, reason, payload);
}
