import { and, eq, inArray, sql } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  bikeModels,
  bikeVariants,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  rentalAssets,
} from "../db/schema";
import {
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  normalizeComputerMountType,
  normalizePedalType,
} from "../inquiries/catalog";
import { getLocationInventory } from "../inventory/repository";

import { isHistoricalAssetSelectableForBooking } from "./historical-availability";
import { appendJournalEntry } from "./ledger";
import { renderBookingInformationChangedMail } from "./messages";
import { formatEuro } from "./money";
import { getAssetPriceSchedule } from "./quotes";
import { BookingCommandError } from "./errors";
import { event, now, queueCustomerMail } from "./service-shared";
import { isValidIsoDate, isValidTime } from "./validation";
import type { BookingRequestedItemCommand } from "./command-types";
import { calculateEquipmentSubtotalCents, calculatePrice, getRentalDays } from "../inventory/pricing";
import { hasAssetConflict } from "./availability";

export type UpdateBookingCommand = {
  bookingId: number;
  expectedVersion: number;
  actorUserId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  customerMessage: string;
  communicationLocale: "de" | "en";
  requestedItems: Array<BookingRequestedItemCommand & { id: number }>;
  quotedTotalCents?: number;
  notifyCustomer?: boolean;
  assetsByRequestedItem?: Record<number, number>;
};

/** Updates editable booking details while keeping offers, allocations and the event history consistent. */
export function updateBooking(db: AppDatabase, input: UpdateBookingCommand) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    if (input.notifyCustomer && booking.status !== "confirmed")
      throw new BookingCommandError("Eine Änderungsmail kann nur für verbindlich gebuchte Buchungen versendet werden");
    if (booking.version !== input.expectedVersion)
      throw new BookingCommandError("Die Buchung wurde zwischenzeitlich geändert. Bitte lade sie neu.");
    const importedPriceEditingAllowed =
      (booking.source === "legacy" || booking.source === "manual") &&
      ["confirmed", "completed"].includes(booking.status);
    if (input.quotedTotalCents !== undefined && !importedPriceEditingAllowed)
      throw new BookingCommandError("Der Mietbetrag kann hier nur bei importierten Buchungen geändert werden");
    if (
      input.quotedTotalCents !== undefined &&
      (!Number.isSafeInteger(input.quotedTotalCents) || input.quotedTotalCents < 0)
    )
      throw new BookingCommandError("Der Mietbetrag ist ungültig");
    if (["completed", "rejected", "cancelled", "expired"].includes(booking.status) && !importedPriceEditingAllowed)
      throw new BookingCommandError("Eine abgeschlossene Buchung kann nicht mehr bearbeitet werden");
    if (
      !isValidIsoDate(input.periodFrom) ||
      !isValidIsoDate(input.periodTo) ||
      input.periodFrom > input.periodTo ||
      !isValidTime(input.pickupTime) ||
      !isValidTime(input.dropoffTime)
    )
      throw new BookingCommandError("Zeitraum und Uhrzeiten sind ungültig");

    const currentItems = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, booking.id))
      .all();
    const currentIds = new Set(currentItems.map((item) => item.id));
    if (
      input.requestedItems.length !== currentItems.length ||
      input.requestedItems.some((item) => !currentIds.has(item.id))
    )
      throw new BookingCommandError("Die Anzahl der Fahrräder kann hier nicht geändert werden");
    const normalizedRequestedItems = input.requestedItems.map((item) => ({
      ...item,
      pedalType: item.needsPedals ? normalizePedalType(item.pedalType) : null,
      computerMountType: item.needsComputerMount ? normalizeComputerMountType(item.computerMountType) : null,
    }));

    const acceptedOffer =
      booking.status === "confirmed"
        ? db
            .select()
            .from(bookingOffers)
            .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "accepted")))
            .all()
            .sort((left, right) => right.offerNumber - left.offerNumber)[0]
        : undefined;
    const acceptedOfferItems = acceptedOffer
      ? db.select().from(bookingOfferItems).where(eq(bookingOfferItems.offerId, acceptedOffer.id)).all()
      : [];
    const currentConcreteAssetByRequestedItem = new Map(
      acceptedOfferItems.map((item) => [item.requestedItemId, item.assetId]),
    );
    let selectedConcreteAssets: Array<{
      asset: typeof rentalAssets.$inferSelect;
      modelTitle: string;
      size: string;
    }> = [];
    let concreteBikeChanged = false;
    if (input.assetsByRequestedItem !== undefined) {
      if (booking.status !== "confirmed")
        throw new BookingCommandError("Konkrete Fahrräder können nur bei bestätigten Buchungen geändert werden");
      const itemIds = currentItems.map((item) => item.id);
      const selectedItemIds = Object.keys(input.assetsByRequestedItem).map(Number);
      const selectedAssetIds = Object.values(input.assetsByRequestedItem);
      if (
        !acceptedOffer ||
        selectedItemIds.length !== itemIds.length ||
        itemIds.some((itemId) => !selectedItemIds.includes(itemId)) ||
        selectedAssetIds.some((assetId) => !Number.isSafeInteger(assetId) || assetId <= 0) ||
        new Set(selectedAssetIds).size !== itemIds.length ||
        acceptedOfferItems.length !== itemIds.length ||
        itemIds.some((itemId) => !currentConcreteAssetByRequestedItem.has(itemId))
      )
        throw new BookingCommandError("Für jedes angefragte Fahrrad muss ein konkretes Fahrrad ausgewählt werden");

      selectedConcreteAssets = db
        .select({ asset: rentalAssets, modelTitle: bikeModels.title, size: bikeVariants.size })
        .from(rentalAssets)
        .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
        .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
        .where(inArray(rentalAssets.id, selectedAssetIds))
        .all();
      if (
        selectedConcreteAssets.length !== itemIds.length ||
        selectedConcreteAssets.some(
          (selected) =>
            selected.asset.location !== booking.location ||
            !isHistoricalAssetSelectableForBooking(booking, {
              ...selected.asset,
              modelTitle: selected.modelTitle,
              size: selected.size,
            }),
        )
      )
        throw new BookingCommandError("Mindestens eines der ausgewählten Fahrräder ist nicht verfügbar");
      concreteBikeChanged = currentItems.some(
        (item) => currentConcreteAssetByRequestedItem.get(item.id) !== input.assetsByRequestedItem![item.id],
      );
    }

    const bikeDetailsChanged = currentItems.some((current) => {
      const next = normalizedRequestedItems.find((item) => item.id === current.id);
      return (
        !next ||
        current.requestedLabel !== next.requestedLabel ||
        current.heightCm !== next.heightCm ||
        current.needsPedals !== Boolean(next.needsPedals) ||
        current.pedalType !== (next.needsPedals ? (next.pedalType ?? null) : null) ||
        current.needsComputerMount !== Boolean(next.needsComputerMount) ||
        current.computerMountType !== (next.needsComputerMount ? (next.computerMountType ?? null) : null) ||
        current.needsHelmet !== Boolean(next.needsHelmet) ||
        current.needsClothing !== Boolean(next.needsClothing) ||
        current.needsBikepackingBag !== Boolean(next.needsBikepackingBag) ||
        current.needsGlasses !== Boolean(next.needsGlasses) ||
        current.bottleHolderIncluded !== (next.bottleHolderIncluded ?? true) ||
        current.repairKitIncluded !== (next.repairKitIncluded ?? true) ||
        current.insuranceProtectionSelected !==
          (next.insuranceProtectionSelected ?? current.insuranceProtectionSelected)
      );
    });
    const commercialChanged =
      booking.periodFrom !== input.periodFrom ||
      booking.periodTo !== input.periodTo ||
      booking.pickupTime !== input.pickupTime ||
      booking.dropoffTime !== input.dropoffTime ||
      bikeDetailsChanged ||
      concreteBikeChanged;
    const quotedTotalChanged =
      input.quotedTotalCents !== undefined && input.quotedTotalCents !== booking.quotedTotalCents;
    if (
      commercialChanged &&
      !["inquiry_received", "offer_sent"].includes(booking.status) &&
      booking.status !== "confirmed"
    )
      throw new BookingCommandError(
        "Fahrrad- und Zeitraumdaten können nach der Bestätigung nicht mehr geändert werden",
      );
    const offerNeedsRevocation =
      booking.status === "offer_sent" &&
      (commercialChanged ||
        booking.customerName !== input.customerName ||
        booking.customerEmail !== input.customerEmail ||
        booking.communicationLocale !== input.communicationLocale);

    const stamp = now();
    const mailChanges: Array<{ labelDe: string; labelEn: string; previous: string; current: string }> = [];
    const addMailChange = (labelDe: string, labelEn: string, previous: string, current: string) => {
      if (previous !== current) mailChanges.push({ labelDe, labelEn, previous, current });
    };
    addMailChange("Name", "Name", booking.customerName, input.customerName);
    addMailChange("E-Mail", "Email", booking.customerEmail, input.customerEmail);
    addMailChange("Telefon", "Phone", booking.customerPhone, input.customerPhone);
    if (quotedTotalChanged)
      addMailChange(
        "Mietbetrag",
        "Rental amount",
        formatEuro(booking.quotedTotalCents),
        formatEuro(input.quotedTotalCents!),
      );
    addMailChange("Abholdatum", "Pickup date", booking.periodFrom, input.periodFrom);
    addMailChange("Rückgabedatum", "Return date", booking.periodTo, input.periodTo);
    addMailChange("Abholzeit", "Pickup time", booking.pickupTime, input.pickupTime);
    addMailChange("Rückgabezeit", "Return time", booking.dropoffTime, input.dropoffTime);
    addMailChange(
      "Kommunikationssprache",
      "Communication language",
      booking.communicationLocale === "de" ? "Deutsch" : "English",
      input.communicationLocale === "de" ? "Deutsch" : "English",
    );
    const formatRequestedItem = (item: BookingRequestedItemCommand) =>
      `${item.requestedLabel} (${item.heightCm} cm${item.needsHelmet ? ", Helm" : ""}${item.needsClothing ? ", Kleidung" : ""}${item.needsPedals ? `, Pedale${item.pedalType ? `: ${getPedalTypeLabel(item.pedalType, "de")}` : ""}` : ""}${item.needsComputerMount ? `, Computerhalterung${item.computerMountType ? `: ${getComputerMountTypeLabel(item.computerMountType, "de")}` : ""}` : ""}${item.needsBikepackingBag ? ", Bikepackingtasche" : ""}${item.needsGlasses ? ", Rennradbrille" : ""})`;
    addMailChange(
      "Fahrräder und Ausstattung",
      "Bikes and equipment",
      currentItems.map(formatRequestedItem).join(", "),
      normalizedRequestedItems.map(formatRequestedItem).join(", "),
    );
    const currentConcreteNamesByRequestedItem = new Map<number, string>();
    for (const offerItem of acceptedOfferItems) {
      const asset = db
        .select({ modelTitle: bikeModels.title, size: bikeVariants.size })
        .from(rentalAssets)
        .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
        .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
        .where(eq(rentalAssets.id, offerItem.assetId))
        .get();
      if (asset)
        currentConcreteNamesByRequestedItem.set(offerItem.requestedItemId, `${asset.modelTitle} - ${asset.size}`);
    }
    if (concreteBikeChanged) {
      addMailChange(
        "Konkrete Fahrräder",
        "Bikes",
        currentItems.map((item) => currentConcreteNamesByRequestedItem.get(item.id) ?? item.requestedLabel).join(", "),
        normalizedRequestedItems
          .map((item) => {
            const selected = selectedConcreteAssets.find(
              (candidate) => candidate.asset.id === input.assetsByRequestedItem![item.id],
            );
            return selected ? `${selected.modelTitle} - ${selected.size}` : item.requestedLabel;
          })
          .join(", "),
      );
    }
    const confirmedPeriodChanged =
      booking.status === "confirmed" &&
      (booking.periodFrom !== input.periodFrom ||
        booking.periodTo !== input.periodTo ||
        booking.pickupTime !== input.pickupTime ||
        booking.dropoffTime !== input.dropoffTime);
    const changedFields = [
      ...(booking.customerName !== input.customerName ? ["customerName"] : []),
      ...(booking.customerEmail !== input.customerEmail ? ["customerEmail"] : []),
      ...(booking.customerPhone !== input.customerPhone ? ["customerPhone"] : []),
      ...(booking.periodFrom !== input.periodFrom ? ["periodFrom"] : []),
      ...(booking.periodTo !== input.periodTo ? ["periodTo"] : []),
      ...(booking.pickupTime !== input.pickupTime ? ["pickupTime"] : []),
      ...(booking.dropoffTime !== input.dropoffTime ? ["dropoffTime"] : []),
      ...(booking.customerMessage !== input.customerMessage ? ["customerMessage"] : []),
      ...(booking.communicationLocale !== input.communicationLocale ? ["communicationLocale"] : []),
      ...(bikeDetailsChanged ? ["requestedItems"] : []),
      ...(concreteBikeChanged ? ["assetAllocations"] : []),
      ...(quotedTotalChanged ? ["quotedTotalCents"] : []),
    ];
    let queuedMailId: number | null = null;
    if (confirmedPeriodChanged || concreteBikeChanged) {
      const activeAllocations = db
        .select()
        .from(bookingAssetAllocations)
        .where(
          and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`),
        )
        .all();
      if (!activeAllocations.length || activeAllocations.length !== acceptedOfferItems.length)
        throw new BookingCommandError("Für die bestätigte Buchung liegen keine vollständigen Fahrradzuordnungen vor");
      db.update(bookingAssetAllocations)
        .set({ releasedAt: stamp })
        .where(
          and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`),
        )
        .run();
      const nextBooking = {
        ...booking,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
      };
      for (const allocation of activeAllocations) {
        const offerItem = acceptedOfferItems.find((item) => item.assetId === allocation.assetId);
        if (!offerItem) throw new BookingCommandError("Die Fahrradzuordnung der Buchung ist inkonsistent");
        const nextAssetId = input.assetsByRequestedItem?.[offerItem.requestedItemId] ?? allocation.assetId;
        if (hasAssetConflict(db, nextBooking, nextAssetId))
          throw new BookingCommandError("Das Fahrrad ist im neuen Zeitraum bereits anderweitig gebucht");
        db.update(bookingAssetAllocations)
          .set({
            assetId: nextAssetId,
            periodFrom: input.periodFrom,
            periodTo: input.periodTo,
            pickupTime: input.pickupTime,
            dropoffTime: input.dropoffTime,
            releasedAt: null,
          })
          .where(eq(bookingAssetAllocations.id, allocation.id))
          .run();
      }
      if (confirmedPeriodChanged)
        db.update(bookingAccessoryAllocations)
          .set({
            periodFrom: input.periodFrom,
            periodTo: input.periodTo,
            pickupTime: input.pickupTime,
            dropoffTime: input.dropoffTime,
          })
          .where(
            and(
              eq(bookingAccessoryAllocations.bookingId, booking.id),
              sql`${bookingAccessoryAllocations.releasedAt} is null`,
            ),
          )
          .run();
    }
    db.update(bookings)
      .set({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
        quotedTotalCents: input.quotedTotalCents ?? booking.quotedTotalCents,
        customerMessage: input.customerMessage,
        communicationLocale: input.communicationLocale,
        version: booking.version + 1,
        updatedAt: stamp,
      })
      .where(eq(bookings.id, booking.id))
      .run();

    if (quotedTotalChanged) {
      const amountDifference = input.quotedTotalCents! - booking.quotedTotalCents;
      if (amountDifference !== 0)
        appendJournalEntry(db, {
          bookingId: booking.id,
          kind: "rental_charge",
          actorUserId: input.actorUserId,
          idempotencyKey: `legacy_booking_price_change:${booking.id}:${booking.version + 1}`,
          reason: "Mietbetrag der importierten Buchung angepasst",
          lines: [
            { account: "accounts_receivable", amountCents: amountDifference },
            { account: "rental_revenue", amountCents: -amountDifference },
          ],
        });
      const latestOffer = db
        .select()
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, booking.id))
        .all()
        .sort((left, right) => right.offerNumber - left.offerNumber)[0];
      if (latestOffer) {
        let priceSnapshot: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(latestOffer.priceSnapshotJson) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            priceSnapshot = parsed as Record<string, unknown>;
        } catch {
          // Keep the snapshot valid even if an old imported record contains malformed JSON.
        }
        const standardTotalCents =
          typeof priceSnapshot.standardTotalCents === "number"
            ? priceSnapshot.standardTotalCents
            : typeof priceSnapshot.calculatedTotalCents === "number"
              ? priceSnapshot.calculatedTotalCents
              : typeof priceSnapshot.totalCents === "number"
                ? priceSnapshot.totalCents
                : input.quotedTotalCents!;
        const customAdjustmentCents = standardTotalCents - input.quotedTotalCents!;
        db.update(bookingOffers)
          .set({
            totalCents: input.quotedTotalCents!,
            priceSnapshotJson: JSON.stringify({
              ...priceSnapshot,
              totalCents: input.quotedTotalCents,
              calculatedTotalCents: standardTotalCents,
              standardTotalCents,
              customPriceCents: input.quotedTotalCents,
              customDiscountCents: Math.max(0, customAdjustmentCents),
              customSurchargeCents: Math.max(0, -customAdjustmentCents),
            }),
          })
          .where(eq(bookingOffers.id, latestOffer.id))
          .run();
      }
    }

    for (const item of normalizedRequestedItems) {
      const currentItem = currentItems.find((current) => current.id === item.id);
      db.update(bookingRequestedItems)
        .set({
          requestedLabel: item.requestedLabel,
          heightCm: item.heightCm,
          needsPedals: Boolean(item.needsPedals),
          pedalType: item.needsPedals ? (item.pedalType ?? null) : null,
          needsComputerMount: Boolean(item.needsComputerMount),
          computerMountType: item.needsComputerMount ? (item.computerMountType ?? null) : null,
          needsHelmet: Boolean(item.needsHelmet),
          needsClothing: Boolean(item.needsClothing),
          needsBikepackingBag: Boolean(item.needsBikepackingBag),
          needsGlasses: Boolean(item.needsGlasses),
          bottleHolderIncluded: item.bottleHolderIncluded ?? true,
          repairKitIncluded: item.repairKitIncluded ?? true,
          insuranceProtectionSelected:
            item.insuranceProtectionSelected ?? currentItem?.insuranceProtectionSelected ?? true,
        })
        .where(and(eq(bookingRequestedItems.id, item.id), eq(bookingRequestedItems.bookingId, booking.id)))
        .run();
    }

    if (acceptedOffer && (confirmedPeriodChanged || concreteBikeChanged || bikeDetailsChanged)) {
      for (const offerItem of acceptedOfferItems) {
        const nextAssetId = input.assetsByRequestedItem?.[offerItem.requestedItemId];
        if (nextAssetId === undefined) continue;
        const selected = selectedConcreteAssets.find((item) => item.asset.id === nextAssetId);
        if (!selected) throw new BookingCommandError("Das ausgewählte Fahrrad konnte nicht geladen werden");
        db.update(bookingOfferItems)
          .set({ assetId: nextAssetId, itemPriceCents: getAssetPriceSchedule(selected.asset).weekdayPriceCents })
          .where(and(eq(bookingOfferItems.id, offerItem.id), eq(bookingOfferItems.offerId, acceptedOffer.id)))
          .run();
      }
      let priceSnapshot: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(acceptedOffer.priceSnapshotJson) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          priceSnapshot = parsed as Record<string, unknown>;
      } catch {
        // Keep old snapshots untouched when an imported record contains malformed JSON.
      }
      const snapshotItems = Array.isArray(priceSnapshot.offeredItems)
        ? (priceSnapshot.offeredItems as Array<Record<string, unknown>>)
        : [];
      if (snapshotItems.length) {
        const updatedSnapshotItems = snapshotItems.map((item) => {
          const requestedItemId = typeof item.requestedItemId === "number" ? item.requestedItemId : null;
          const nextAssetId = requestedItemId === null ? undefined : input.assetsByRequestedItem?.[requestedItemId];
          const selected =
            nextAssetId === undefined
              ? undefined
              : selectedConcreteAssets.find((asset) => asset.asset.id === nextAssetId);
          const requested = normalizedRequestedItems.find((candidate) => candidate.id === requestedItemId);
          const nextItem = requested
            ? {
                ...item,
                requestedLabel: requested.requestedLabel,
                heightCm: requested.heightCm,
                accessories: {
                  needsPedals: Boolean(requested.needsPedals),
                  pedalType: requested.needsPedals ? (requested.pedalType ?? null) : null,
                  needsComputerMount: Boolean(requested.needsComputerMount),
                  computerMountType: requested.needsComputerMount ? (requested.computerMountType ?? null) : null,
                  needsHelmet: Boolean(requested.needsHelmet),
                  needsClothing: Boolean(requested.needsClothing),
                  needsBikepackingBag: Boolean(requested.needsBikepackingBag),
                  needsGlasses: Boolean(requested.needsGlasses),
                  bottleHolderIncluded: requested.bottleHolderIncluded ?? true,
                  repairKitIncluded: requested.repairKitIncluded ?? true,
                  insuranceProtectionSelected: requested.insuranceProtectionSelected ?? true,
                },
              }
            : item;
          if (!selected) return nextItem;
          const priceSchedule = getAssetPriceSchedule(selected.asset);
          return {
            ...nextItem,
            assetId: selected.asset.id,
            assetName: selected.asset.displayName,
            frameNumber: selected.asset.frameNumber,
            dailyPriceCents: priceSchedule.weekdayPriceCents,
            weekdayPriceCents: priceSchedule.weekdayPriceCents,
            weekendPriceCents: priceSchedule.weekendPriceCents,
          };
        });
        const rentalDays = getRentalDays(input.periodFrom, input.periodTo);
        const pricingInventory = getLocationInventory(db, booking.location);
        const recalculated = calculatePrice(pricingInventory, {
          bikes: updatedSnapshotItems.map((item) => ({
            dailyPriceCents: typeof item.dailyPriceCents === "number" ? item.dailyPriceCents : 0,
            weekdayPriceCents: typeof item.weekdayPriceCents === "number" ? item.weekdayPriceCents : undefined,
            weekendPriceCents: typeof item.weekendPriceCents === "number" ? item.weekendPriceCents : undefined,
          })),
          equipmentSubtotalCents: bikeDetailsChanged
            ? calculateEquipmentSubtotalCents(pricingInventory, normalizedRequestedItems)
            : typeof priceSnapshot.equipmentSubtotalCents === "number"
              ? priceSnapshot.equipmentSubtotalCents
              : 0,
          periodFrom: input.periodFrom,
          rentalDays,
          isStudent:
            priceSnapshot.isStudent === true ||
            (Array.isArray(priceSnapshot.appliedDiscountKeys) && priceSnapshot.appliedDiscountKeys.includes("student")),
        });
        const totalCents =
          typeof priceSnapshot.customPriceCents === "number" ? priceSnapshot.customPriceCents : recalculated.totalCents;
        const customAdjustmentCents = recalculated.totalCents - totalCents;
        db.update(bookingOffers)
          .set({
            priceSnapshotJson: JSON.stringify({
              ...priceSnapshot,
              offeredItems: updatedSnapshotItems,
              rentalDays,
              isStudent:
                priceSnapshot.isStudent === true ||
                (Array.isArray(priceSnapshot.appliedDiscountKeys) &&
                  priceSnapshot.appliedDiscountKeys.includes("student")),
              bikeSubtotalCents: recalculated.bikeSubtotalCents,
              totalCents,
              standardTotalCents: recalculated.totalCents,
              equipmentSubtotalCents: recalculated.equipmentSubtotalCents,
              discountCents: recalculated.discountCents,
              appliedDiscountKeys: recalculated.appliedDiscountKeys,
              bikePriceLines: updatedSnapshotItems.map((item, index) => ({
                assetId: item.assetId,
                ...recalculated.bikeBreakdown[index],
              })),
              customDiscountCents: Math.max(0, customAdjustmentCents),
              customSurchargeCents: Math.max(0, -customAdjustmentCents),
            }),
          })
          .where(eq(bookingOffers.id, acceptedOffer.id))
          .run();
      }
    }

    if (offerNeedsRevocation)
      db.update(bookingOffers)
        .set({ status: "revoked", revokedAt: stamp })
        .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
        .run();

    if (input.notifyCustomer && booking.status === "confirmed" && changedFields.length && mailChanges.length) {
      const notice = renderBookingInformationChangedMail({
        locale: input.communicationLocale,
        name: input.customerName,
        orderNumber: booking.orderNumber,
        location: booking.location,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
        bikes: normalizedRequestedItems.map((item) => {
          if (!input.assetsByRequestedItem) return item.requestedLabel;
          const selected = selectedConcreteAssets.find(
            (candidate) => candidate.asset.id === input.assetsByRequestedItem![item.id],
          );
          return selected
            ? `${selected.modelTitle} - ${selected.size}`
            : (currentConcreteNamesByRequestedItem.get(item.id) ?? item.requestedLabel);
        }),
        changes: mailChanges,
      });
      queuedMailId = queueCustomerMail(
        db,
        { ...booking, ...input },
        {
          kind: "booking_information_changed",
          idempotencyKey: `booking:${booking.id}:booking_information_changed:${booking.version + 1}`,
          mail: notice,
        },
      );
    }

    event(
      db,
      booking.id,
      "booking_updated",
      booking.status,
      booking.status,
      input.actorUserId,
      "Buchungsdaten bearbeitet",
      {
        changedFields,
        revokedOffer: offerNeedsRevocation,
        customerNotified: Boolean(queuedMailId),
      },
    );
    return { bookingId: booking.id, version: booking.version + 1, mailId: queuedMailId };
  });
}
