import { createHash } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  bookingOfferItems,
  bookingOffers,
  bookingPublicLinks,
  bookingRequestedItems,
  bookings,
  rentalAssets,
} from "../db/schema";
import { getRentalDays } from "../inventory/pricing";
import { getLocationInventory } from "../inventory/repository";
import type { OfferAccessorySelection, OfferQuote } from "./quotes";

export type PublicOffer = {
  offerId: number | null;
  offerNumber: number | null;
  status: "sent" | "accepted" | "expired" | "revoked" | null;
  expiresAt: string | null;
  booking: {
    id: number;
    orderNumber: string;
    name: string;
    location: string;
    periodFrom: string;
    periodTo: string;
    pickupTime: string;
    dropoffTime: string;
    locale: "de" | "en";
    status: string;
    updatedAt: string;
  };
  totalCents: number;
  quote: Pick<
    OfferQuote,
    | "bikeSubtotalCents"
    | "equipmentSubtotalCents"
    | "discountCents"
    | "rentalDays"
    | "calculatedTotalCents"
    | "customPriceCents"
  >;
  items: Array<{
    position: number;
    requestedLabel: string;
    offeredLabel: string;
    frameNumber: string | null;
    heightCm: number;
    dailyPriceCents: number;
    accessories: OfferAccessorySelection;
  }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPublicBookingView(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  offer: typeof bookingOffers.$inferSelect | null,
): PublicOffer {
  const requested = db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, booking.id))
    .all()
    .sort((left, right) => left.position - right.position);
  const offered = offer
    ? db
        .select({ item: bookingOfferItems, asset: rentalAssets })
        .from(bookingOfferItems)
        .innerJoin(rentalAssets, eq(bookingOfferItems.assetId, rentalAssets.id))
        .where(eq(bookingOfferItems.offerId, offer.id))
        .all()
    : [];
  const snapshot = offer ? (JSON.parse(offer.priceSnapshotJson) as Partial<OfferQuote>) : {};
  const offeredByRequestedId = new Map(offered.map(({ item, asset }) => [item.requestedItemId, { item, asset }]));
  const snapshotByRequestedId = new Map((snapshot.offeredItems ?? []).map((item) => [item.requestedItemId, item]));
  const inventoryPriceByOption = new Map(
    getLocationInventory(db, booking.location).bikePrices.map((bike) => [bike.option, bike.dailyPriceCents]),
  );
  const priceForRequestedBike = (requestedBike: string) =>
    inventoryPriceByOption.get(requestedBike) ??
    inventoryPriceByOption.get(requestedBike.split(" - ")[0]) ??
    0;

  return {
    offerId: offer?.id ?? null,
    offerNumber: offer?.offerNumber ?? null,
    status: offer?.status ?? null,
    expiresAt: offer?.expiresAt.toISOString() ?? null,
    booking: {
      id: booking.id,
      orderNumber: booking.orderNumber,
      name: booking.customerName,
      location: booking.location,
      periodFrom: booking.periodFrom,
      periodTo: booking.periodTo,
      pickupTime: booking.pickupTime,
      dropoffTime: booking.dropoffTime,
      locale: booking.communicationLocale,
      status: booking.status,
      updatedAt: booking.updatedAt.toISOString(),
    },
    totalCents: offer?.totalCents ?? booking.quotedTotalCents,
    quote: {
      bikeSubtotalCents: snapshot.bikeSubtotalCents ?? 0,
      equipmentSubtotalCents: snapshot.equipmentSubtotalCents ?? 0,
      discountCents: snapshot.discountCents ?? 0,
      rentalDays: snapshot.rentalDays ?? getRentalDays(booking.periodFrom, booking.periodTo),
      calculatedTotalCents: snapshot.calculatedTotalCents,
      customPriceCents: snapshot.customPriceCents,
    },
    items: requested.map((item) => {
      const selected = offeredByRequestedId.get(item.id);
      const snapshotItem = snapshotByRequestedId.get(item.id);
      return {
        position: item.position,
        requestedLabel: item.requestedLabel,
        offeredLabel: selected?.asset.displayName ?? snapshotItem?.assetName ?? item.requestedLabel,
        frameNumber: selected?.asset.frameNumber ?? snapshotItem?.frameNumber ?? null,
        heightCm: item.heightCm,
        dailyPriceCents:
          (selected?.item.itemPriceCents && selected.item.itemPriceCents > 0 ? selected.item.itemPriceCents : null) ??
          selected?.asset.dailyPriceCents ??
          (snapshotItem?.dailyPriceCents && snapshotItem.dailyPriceCents > 0 ? snapshotItem.dailyPriceCents : null) ??
          priceForRequestedBike(item.requestedLabel),
        accessories: snapshotItem?.accessories ?? {
          needsPedals: item.needsPedals,
          pedalType: item.pedalType,
          needsComputerMount: item.needsComputerMount,
          computerMountType: item.computerMountType,
          needsHelmet: item.needsHelmet,
          needsClothing: item.needsClothing,
        },
      };
    }),
  };
}

export function getPublicOfferByToken(db: AppDatabase, token: string): PublicOffer | null {
  if (!token || token.length > 200) return null;
  const offer = db
    .select()
    .from(bookingOffers)
    .where(eq(bookingOffers.tokenHash, hashToken(token)))
    .get();
  if (!offer) return null;
  const booking = db.select().from(bookings).where(eq(bookings.id, offer.bookingId)).get();
  return booking ? buildPublicBookingView(db, booking, offer) : null;
}

/**
 * Checkout needs the recipient address server-side, but it must not be part
 * of the bearer-token response sent to the customer's browser.
 */
export function getPublicBookingContactEmail(db: AppDatabase, token: string): string | null {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const offer = db.select().from(bookingOffers).where(eq(bookingOffers.tokenHash, tokenHash)).get();
  if (offer)
    return (
      db.select({ email: bookings.customerEmail }).from(bookings).where(eq(bookings.id, offer.bookingId)).get()
        ?.email ?? null
    );

  const link = db.select().from(bookingPublicLinks).where(eq(bookingPublicLinks.tokenHash, tokenHash)).get();
  if (!link) return null;
  return (
    db.select({ email: bookings.customerEmail }).from(bookings).where(eq(bookings.id, link.bookingId)).get()?.email ??
    null
  );
}

/** Resolves the stable link sent with the initial inquiry confirmation. */
export function getPublicBookingByToken(db: AppDatabase, token: string): PublicOffer | null {
  if (!token || token.length > 200) return null;
  const link = db
    .select()
    .from(bookingPublicLinks)
    .where(eq(bookingPublicLinks.tokenHash, hashToken(token)))
    .get();
  if (!link) return null;
  const booking = db.select().from(bookings).where(eq(bookings.id, link.bookingId)).get();
  if (!booking) return null;
  const latestOffer = db
    .select()
    .from(bookingOffers)
    .where(eq(bookingOffers.bookingId, booking.id))
    .orderBy(desc(bookingOffers.offerNumber))
    .get();
  return buildPublicBookingView(db, booking, latestOffer ?? null);
}
