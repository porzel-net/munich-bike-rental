import { createHash, randomBytes } from "node:crypto";

import { and, eq, inArray, isNull, lte, ne } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { accountingRevenues, rentalBookingConfirmationTokens, rentalInquiryBikes, rentalInquiries } from "../db/schema";
import type { RentalLocation } from "./catalog";

export const BOOKING_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1_000;

export type BookingConfirmationBike = {
  bikeSize: string;
  heightCm: number;
  pedalType: string | null;
  computerMountType: string | null;
  needsPedals: boolean;
  needsComputerMount: boolean;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag: boolean;
  needsGlasses: boolean;
  bottleHolderIncluded: boolean;
  repairKitIncluded: boolean;
};

export type BookingConfirmationDetails = {
  orderNumber: string;
  name: string;
  email: string;
  phone: string;
  location: RentalLocation;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  totalPriceCents: number;
  message: string;
  bikes: BookingConfirmationBike[];
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBookingDetails(db: AppDatabase, inquiryId: number): BookingConfirmationDetails | null {
  const inquiry = db
    .select({
      orderNumber: rentalInquiries.orderNumber,
      name: rentalInquiries.name,
      email: rentalInquiries.email,
      phone: rentalInquiries.phone,
      location: rentalInquiries.location,
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      pickupTime: rentalInquiries.pickupTime,
      dropoffTime: rentalInquiries.dropoffTime,
      totalPriceCents: rentalInquiries.totalPriceCents,
      message: rentalInquiries.message,
    })
    .from(rentalInquiries)
    .where(eq(rentalInquiries.id, inquiryId))
    .get();

  if (!inquiry) return null;

  const bikes = db
    .select({
      bikeSize: rentalInquiryBikes.bikeSize,
      heightCm: rentalInquiryBikes.heightCm,
      pedalType: rentalInquiryBikes.pedalType,
      computerMountType: rentalInquiryBikes.computerMountType,
      needsPedals: rentalInquiryBikes.needsPedals,
      needsComputerMount: rentalInquiryBikes.needsComputerMount,
      needsHelmet: rentalInquiryBikes.needsHelmet,
      needsClothing: rentalInquiryBikes.needsClothing,
      needsBikepackingBag: rentalInquiryBikes.needsBikepackingBag,
      needsGlasses: rentalInquiryBikes.needsGlasses,
      bottleHolderIncluded: rentalInquiryBikes.bottleHolderIncluded,
      repairKitIncluded: rentalInquiryBikes.repairKitIncluded,
    })
    .from(rentalInquiryBikes)
    .where(eq(rentalInquiryBikes.inquiryId, inquiryId))
    .all();

  return {
    ...inquiry,
    location: inquiry.location as RentalLocation,
    bikes,
  };
}

export function createBookingConfirmationToken(db: AppDatabase, inquiryId: number) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BOOKING_CONFIRMATION_TTL_MS);

  db.transaction((transaction) => {
    transaction
      .delete(rentalBookingConfirmationTokens)
      .where(
        and(
          eq(rentalBookingConfirmationTokens.inquiryId, inquiryId),
          isNull(rentalBookingConfirmationTokens.confirmedAt),
        ),
      )
      .run();
    transaction
      .insert(rentalBookingConfirmationTokens)
      .values({
        inquiryId,
        tokenHash: hashToken(token),
        expiresAt,
        createdAt: now,
      })
      .run();
  });

  return { token, expiresAt };
}

export function revokeBookingConfirmationToken(db: AppDatabase, token: string) {
  db.delete(rentalBookingConfirmationTokens)
    .where(eq(rentalBookingConfirmationTokens.tokenHash, hashToken(token)))
    .run();
}

/** Move unanswered confirmation requests back to the inbox once their link expires. */
export function expirePendingBookingConfirmations(db: AppDatabase, now = new Date()) {
  const expiredInquiryIds = db
    .select({ inquiryId: rentalBookingConfirmationTokens.inquiryId })
    .from(rentalBookingConfirmationTokens)
    .innerJoin(rentalInquiries, eq(rentalInquiries.id, rentalBookingConfirmationTokens.inquiryId))
    .where(
      and(
        eq(rentalInquiries.status, "pending"),
        isNull(rentalBookingConfirmationTokens.confirmedAt),
        lte(rentalBookingConfirmationTokens.expiresAt, now),
      ),
    )
    .all()
    .map(({ inquiryId }) => inquiryId);

  if (expiredInquiryIds.length === 0) return 0;

  return db
    .update(rentalInquiries)
    .set({ status: "unanswered" })
    .where(and(eq(rentalInquiries.status, "pending"), inArray(rentalInquiries.id, expiredInquiryIds)))
    .run().changes;
}

export function confirmBookingWithToken(
  db: AppDatabase,
  token: string,
  now = new Date(),
):
  | { ok: true; alreadyConfirmed: boolean; booking: BookingConfirmationDetails }
  | { ok: false; reason: "invalid" | "expired" | "rejected" | "unavailable" } {
  const tokenRow = db
    .select({
      id: rentalBookingConfirmationTokens.id,
      inquiryId: rentalBookingConfirmationTokens.inquiryId,
      expiresAt: rentalBookingConfirmationTokens.expiresAt,
      confirmedAt: rentalBookingConfirmationTokens.confirmedAt,
      status: rentalInquiries.status,
      location: rentalInquiries.location,
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      name: rentalInquiries.name,
      totalPriceCents: rentalInquiries.totalPriceCents,
    })
    .from(rentalBookingConfirmationTokens)
    .innerJoin(rentalInquiries, eq(rentalInquiries.id, rentalBookingConfirmationTokens.inquiryId))
    .where(eq(rentalBookingConfirmationTokens.tokenHash, hashToken(token)))
    .get();

  if (!tokenRow) return { ok: false, reason: "invalid" };
  if (tokenRow.confirmedAt) {
    const booking = getBookingDetails(db, tokenRow.inquiryId);
    return booking ? { ok: true, alreadyConfirmed: true, booking } : { ok: false, reason: "invalid" };
  }
  if (tokenRow.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (tokenRow.status === "rejected") return { ok: false, reason: "rejected" };

  const requestedBikes = db
    .select({ bikeSize: rentalInquiryBikes.bikeSize })
    .from(rentalInquiryBikes)
    .where(eq(rentalInquiryBikes.inquiryId, tokenRow.inquiryId))
    .all();
  const confirmedBikes = db
    .select({
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      bikeSize: rentalInquiryBikes.bikeSize,
    })
    .from(rentalInquiryBikes)
    .innerJoin(rentalInquiries, eq(rentalInquiries.id, rentalInquiryBikes.inquiryId))
    .where(
      and(
        eq(rentalInquiries.location, tokenRow.location),
        inArray(rentalInquiries.status, ["confirmed", "executed"]),
        ne(rentalInquiries.id, tokenRow.inquiryId),
      ),
    )
    .all();

  const conflicts = confirmedBikes.some((confirmedBike) =>
    requestedBikes.some(
      (requestedBike) =>
        requestedBike.bikeSize === confirmedBike.bikeSize &&
        tokenRow.periodFrom <= confirmedBike.periodTo &&
        tokenRow.periodTo >= confirmedBike.periodFrom,
    ),
  );
  if (conflicts) return { ok: false, reason: "unavailable" };

  db.transaction((transaction) => {
    transaction
      .update(rentalBookingConfirmationTokens)
      .set({ confirmedAt: now })
      .where(
        and(eq(rentalBookingConfirmationTokens.id, tokenRow.id), isNull(rentalBookingConfirmationTokens.confirmedAt)),
      )
      .run();
    transaction
      .update(rentalInquiries)
      .set({ status: "confirmed" })
      .where(eq(rentalInquiries.id, tokenRow.inquiryId))
      .run();
    transaction
      .insert(accountingRevenues)
      .values({
        inquiryId: tokenRow.inquiryId,
        amountCents: tokenRow.totalPriceCents,
        paidAmountCents: 0,
        paymentReceivedAt: null,
        payerName: tokenRow.name,
        notes: "",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: accountingRevenues.inquiryId })
      .run();
  });

  const booking = getBookingDetails(db, tokenRow.inquiryId);
  return booking ? { ok: true, alreadyConfirmed: false, booking } : { ok: false, reason: "invalid" };
}
