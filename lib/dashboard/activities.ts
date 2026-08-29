import { and, desc, eq, ne } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/client";
import { bookings, financialTransactions, journalEntries } from "@/lib/db/schema";
import { receivedAtFromOrderNumber } from "@/lib/bookings/order-number";
import type { RentalLocation } from "@/lib/inquiries/catalog";

export type DashboardActivityKind =
  "expired_booking" | "paid_booking" | "bank_transaction" | "incoming_booking_request";

export type DashboardActivity = {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  entityName: string;
  href: string;
  occurredAt: number;
  isUrgent?: boolean;
};

function bookingIncomingAt(booking: { source: string; orderNumber: string; createdAt: Date }) {
  return booking.source === "legacy"
    ? (receivedAtFromOrderNumber(booking.orderNumber) ?? booking.createdAt)
    : booking.createdAt;
}

function activityTimestamp(value: Date | string) {
  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getDashboardActivities(
  db: AppDatabase,
  { isAdmin, location }: { isAdmin: boolean; location: RentalLocation | null },
): DashboardActivity[] {
  const allBookingMetrics = db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      status: bookings.status,
      createdAt: bookings.createdAt,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
    })
    .from(bookings)
    .where(location ? eq(bookings.location, location) : undefined)
    .all()
    .map((booking) => ({ ...booking, createdAt: bookingIncomingAt(booking) }));

  const paidBookingRows = db
    .select({ bookingId: journalEntries.bookingId, occurredAt: journalEntries.occurredAt })
    .from(journalEntries)
    .innerJoin(bookings, eq(journalEntries.bookingId, bookings.id))
    .where(and(eq(journalEntries.kind, "payment_received"), location ? eq(bookings.location, location) : undefined))
    .all();
  const paidAtByBooking = new Map<number, Date>();
  for (const row of paidBookingRows) {
    if (row.bookingId === null) continue;
    const previous = paidAtByBooking.get(row.bookingId);
    if (!previous || row.occurredAt > previous) paidAtByBooking.set(row.bookingId, row.occurredAt);
  }

  const bankTransactionsToReview = isAdmin
    ? db
        .select({
          id: financialTransactions.id,
          counterpartyName: financialTransactions.counterpartyNameSnapshot,
          description: financialTransactions.description,
          reference: financialTransactions.reference,
          bookedAt: financialTransactions.bookedAt,
        })
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.source, "bank"),
            eq(financialTransactions.provider, "nevlo"),
            ne(financialTransactions.status, "posted"),
            ne(financialTransactions.status, "ignored"),
          ),
        )
        .orderBy(desc(financialTransactions.bookedAt), desc(financialTransactions.id))
        .all()
    : [];

  return [
    ...allBookingMetrics
      .filter((booking) => booking.status === "expired")
      .map((booking) => ({
        id: `expired-booking-${booking.id}`,
        kind: "expired_booking" as const,
        title: "Buchung ausgelaufen",
        entityName: booking.customerName,
        href: `/admin/bookings/${booking.id}`,
        occurredAt: activityTimestamp(booking.periodTo),
      })),
    ...allBookingMetrics
      .filter((booking) => paidAtByBooking.has(booking.id))
      .map((booking) => ({
        id: `paid-booking-${booking.id}`,
        kind: "paid_booking" as const,
        title: "Zahlung erhalten",
        entityName: booking.customerName,
        href: `/admin/bookings/${booking.id}`,
        occurredAt: paidAtByBooking.get(booking.id)!.getTime(),
      })),
    ...bankTransactionsToReview.map((transaction) => ({
      id: `bank-transaction-${transaction.id}`,
      kind: "bank_transaction" as const,
      title: "Neue Banktransaktion prüfen",
      entityName:
        transaction.counterpartyName?.trim() ||
        transaction.description?.trim() ||
        transaction.reference?.trim() ||
        "Banktransaktion",
      href: `/admin/accounting/transactions?transaction=${transaction.id}`,
      occurredAt: activityTimestamp(transaction.bookedAt),
    })),
    ...allBookingMetrics
      .filter((booking) => booking.status === "inquiry_received")
      .map((booking) => ({
        id: `incoming-booking-${booking.id}`,
        kind: "incoming_booking_request" as const,
        title: "Neue Buchungsanfrage",
        entityName: booking.customerName,
        href: `/admin/bookings/${booking.id}`,
        occurredAt: booking.createdAt.getTime(),
        isUrgent: Date.now() - booking.createdAt.getTime() >= 24 * 60 * 60 * 1000,
      })),
  ].sort((left, right) => right.occurredAt - left.occurredAt);
}
