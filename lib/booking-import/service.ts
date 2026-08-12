import { createHash } from "node:crypto";

import { eq, or } from "drizzle-orm";

import { createBookingInTransaction, type CreateBookingCommand } from "@/lib/bookings/service";
import { runInImmediateTransaction, type AppDatabase } from "@/lib/db/client";
import { bookings, communicationMessages } from "@/lib/db/schema";
import { calculateInquiryPrice } from "@/lib/inventory/pricing";
import { getLocationInventory } from "@/lib/inventory/repository";

import { loadBookingCandidateMails } from "./mail-client";
import { importExclusionReason, isBookingInquiry, isExportableBooking, parseBookingRequest } from "./parser";
import type { BookingRequestImport } from "./types";

function dedupeKey(record: BookingRequestImport) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        record.email.trim().toLocaleLowerCase(),
        record.name.trim().toLocaleLowerCase(),
        record.periodFrom,
        record.periodTo,
        record.pickupTime,
        record.dropoffTime,
        record.requestedItems.map((item) => item.requestedLabel.trim().toLocaleLowerCase()),
      ]),
    )
    .digest("hex");
}

function chooseBetter(current: BookingRequestImport, candidate: BookingRequestImport) {
  return candidate.missingFields.length < current.missingFields.length ? candidate : current;
}

function calculateLegacyBookingValue(db: AppDatabase, record: BookingRequestImport) {
  return calculateInquiryPrice(getLocationInventory(db, record.location), {
    name: record.name,
    contact: record.email,
    phone: record.phone,
    location: record.location,
    periodFrom: record.periodFrom,
    periodTo: record.periodTo,
    pickupTime: record.pickupTime,
    dropoffTime: record.dropoffTime,
    message: record.message || "Historischer Import",
    bikeTitle: record.requestedItems[0]?.requestedLabel ?? "",
    locale: record.locale,
    affiliateKey: "",
    website: "",
    bikes: record.requestedItems.map((item) => ({
      height: String(item.heightCm),
      bikeSize: item.requestedLabel,
      needsPedals: item.needsPedals,
      pedalType: item.pedalType ?? "",
      needsComputerMount: item.needsComputerMount,
      computerMountType: item.computerMountType ?? "",
      needsHelmet: item.needsHelmet,
      needsClothing: item.needsClothing,
      needsBikepackingBag: item.needsBikepackingBag,
      needsGlasses: item.needsGlasses,
      bottleHolderIncluded: true as const,
      repairKitIncluded: true as const,
    })),
  }).totalCents;
}

function archiveImportedSourceMessage(db: AppDatabase, bookingId: number, record: BookingRequestImport) {
  const source = record._source;
  const existing = db
    .select({ id: communicationMessages.id })
    .from(communicationMessages)
    .where(eq(communicationMessages.rfcMessageId, source.emailId))
    .get();
  if (existing) return;

  db.insert(communicationMessages)
    .values({
      bookingId,
      direction: "inbound",
      rfcMessageId: source.emailId,
      threadMessageId: source.threadMessageId,
      inReplyTo: source.inReplyTo,
      referencesHeader: source.referencesHeader,
      sender: source.from ?? "unknown",
      recipients: source.recipients,
      subject: source.subject ?? "",
      plainText: source.bodyText,
      sentAt: source.sentAt ? new Date(source.sentAt) : new Date(),
      archivedAt: new Date(),
    })
    .run();
}

export type LegacyBookingImportSummary = {
  sourceEmails: number;
  candidateEmails: number;
  created: number;
  skippedExisting: number;
  deduplicated: number;
  excludedCustomer: number;
  excludedMissingEmail: number;
  excludedUnknownModel: number;
};

export async function importLegacyBookingEmails(db: AppDatabase, actorUserId?: string | null) {
  const mails = await loadBookingCandidateMails();
  const inquiryMails = mails.filter(isBookingInquiry);
  const parsed = inquiryMails.map(parseBookingRequest);
  const summary: LegacyBookingImportSummary = {
    sourceEmails: mails.length,
    candidateEmails: inquiryMails.length,
    created: 0,
    skippedExisting: 0,
    deduplicated: 0,
    excludedCustomer: 0,
    excludedMissingEmail: 0,
    excludedUnknownModel: 0,
  };
  const exportable: Array<{ record: BookingRequestImport; key: string }> = [];
  for (const record of parsed) {
    const reason = importExclusionReason(record);
    if (reason === "excluded_customer") summary.excludedCustomer += 1;
    else if (reason === "missing_email") summary.excludedMissingEmail += 1;
    else if (reason === "unknown_model") summary.excludedUnknownModel += 1;
    if (reason || !isExportableBooking(record)) continue;
    exportable.push({ record, key: dedupeKey(record) });
  }

  const grouped = new Map<string, { record: BookingRequestImport; key: string }>();
  for (const candidate of exportable) {
    const current = grouped.get(candidate.key);
    if (current) {
      grouped.set(candidate.key, { ...candidate, record: chooseBetter(current.record, candidate.record) });
      summary.deduplicated += 1;
    } else grouped.set(candidate.key, candidate);
  }

  runInImmediateTransaction(db, () => {
    for (const candidate of grouped.values()) {
      const sourceId = candidate.record._source.emailId;
      const existing = db
        .select({ id: bookings.id, quotedTotalCents: bookings.quotedTotalCents })
        .from(bookings)
        .where(or(eq(bookings.legacySourceId, sourceId), eq(bookings.legacyDedupeKey, candidate.key)))
        .get();
      if (existing) {
        archiveImportedSourceMessage(db, existing.id, candidate.record);
        if (existing.quotedTotalCents === 0) {
          db.update(bookings)
            .set({ quotedTotalCents: calculateLegacyBookingValue(db, candidate.record), updatedAt: new Date() })
            .where(eq(bookings.id, existing.id))
            .run();
        }
        summary.skippedExisting += 1;
        continue;
      }
      const input: CreateBookingCommand = {
        customerName: candidate.record.name,
        customerEmail: candidate.record.email,
        customerPhone: candidate.record.phone,
        location: candidate.record.location,
        periodFrom: candidate.record.periodFrom,
        periodTo: candidate.record.periodTo,
        pickupTime: candidate.record.pickupTime,
        dropoffTime: candidate.record.dropoffTime,
        customerMessage: candidate.record.message,
        communicationLocale: candidate.record.locale,
        source: "legacy",
        quotedTotalCents: calculateLegacyBookingValue(db, candidate.record),
        requestedItems: candidate.record.requestedItems,
        legacySourceId: sourceId,
        legacyDedupeKey: candidate.key,
        legacyReceivedAt: candidate.record._source.sentAt ? new Date(candidate.record._source.sentAt) : null,
      };
      const created = createBookingInTransaction(db, input, actorUserId);
      archiveImportedSourceMessage(db, created.id, candidate.record);
      summary.created += 1;
    }
  });
  return summary;
}

export { dedupeKey };
