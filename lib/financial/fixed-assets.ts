import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { runInImmediateTransaction } from "../db/client";
import { appendJournalEntry } from "../bookings/ledger";
import { BookingCommandError } from "../bookings/errors";
import { fixedAssetDepreciationEntries, fixedAssets } from "../db/schema";

function parseMonth(value: string) {
  const match = /^([0-9]{4})-([0-9]{2})/.exec(value.trim());
  if (!match) throw new BookingCommandError("Ungültiges Datum für die Abschreibung.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new BookingCommandError("Ungültiges Datum für die Abschreibung.");
  return { year, month };
}

function monthIndex(value: string) {
  const { year, month } = parseMonth(value);
  return year * 12 + month - 1;
}

function monthDate(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function monthlyDepreciationCents(
  asset: Pick<
    typeof fixedAssets.$inferSelect,
    "acquisitionCostCents" | "residualValueCents" | "usefulLifeMonths" | "inServiceDate"
  >,
  periodStart: string,
) {
  const depreciableCents = asset.acquisitionCostCents - asset.residualValueCents;
  if (depreciableCents <= 0) return 0;
  const startMonth = monthIndex(asset.inServiceDate);
  const monthlyBase = Math.floor(depreciableCents / asset.usefulLifeMonths);
  const monthNumber = monthIndex(periodStart) - startMonth;
  if (monthNumber < 0 || monthNumber >= asset.usefulLifeMonths) return 0;
  if (monthNumber === asset.usefulLifeMonths - 1) return depreciableCents - monthlyBase * monthNumber;
  return monthlyBase;
}

export function fixedAssetDepreciationSchedule(
  asset: Pick<
    typeof fixedAssets.$inferSelect,
    "acquisitionCostCents" | "residualValueCents" | "usefulLifeMonths" | "inServiceDate"
  >,
) {
  const start = monthIndex(asset.inServiceDate);
  return Array.from({ length: asset.usefulLifeMonths }, (_, index) => {
    const periodStart = monthDate(start + index);
    return {
      periodStart,
      periodEnd: monthDate(start + index + 1),
      amountCents: monthlyDepreciationCents(asset, periodStart),
    };
  }).filter((entry) => entry.amountCents > 0);
}

export function createFixedAsset(
  db: AppDatabase,
  input: {
    name: string;
    assetType: "bike" | "equipment" | "other";
    acquisitionSource?: "transaction" | "private_contribution";
    serialNumber?: string | null;
    acquisitionDate: string;
    inServiceDate: string;
    acquisitionCostCents: number;
    inputVatCents?: number;
    usefulLifeMonths: number;
    residualValueCents?: number;
    sourceTransactionId?: number | null;
    notes?: string;
    createdByUserId?: string | null;
  },
) {
  const name = input.name.trim();
  if (!name) throw new BookingCommandError("Bitte benenne das Anlagegut.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.acquisitionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.inServiceDate))
    throw new BookingCommandError("Bitte verwende gültige Anschaffungs- und Inbetriebnahmedaten.");
  if (input.acquisitionCostCents <= 0 || !Number.isSafeInteger(input.acquisitionCostCents))
    throw new BookingCommandError("Die Anschaffungskosten müssen größer als 0 sein.");
  if (input.inputVatCents && (!Number.isSafeInteger(input.inputVatCents) || input.inputVatCents < 0))
    throw new BookingCommandError("Die Vorsteuer muss 0 oder größer sein.");
  if (!Number.isSafeInteger(input.usefulLifeMonths) || input.usefulLifeMonths < 1)
    throw new BookingCommandError("Die Nutzungsdauer muss mindestens einen Monat betragen.");
  const residualValueCents = input.residualValueCents ?? 0;
  if (
    !Number.isSafeInteger(residualValueCents) ||
    residualValueCents < 0 ||
    residualValueCents >= input.acquisitionCostCents
  )
    throw new BookingCommandError("Der Restwert muss zwischen 0 und den Anschaffungskosten liegen.");
  if (input.inServiceDate < input.acquisitionDate)
    throw new BookingCommandError("Die Inbetriebnahme darf nicht vor der Anschaffung liegen.");

  const now = new Date();
  const asset = db
    .insert(fixedAssets)
    .values({
      assetNumber: `ANL-${new Date(`${input.acquisitionDate}T00:00:00Z`).getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      assetType: input.assetType,
      acquisitionSource: input.acquisitionSource ?? "transaction",
      serialNumber: input.serialNumber?.trim() || null,
      acquisitionDate: input.acquisitionDate,
      inServiceDate: input.inServiceDate,
      acquisitionCostCents: input.acquisitionCostCents,
      inputVatCents: input.inputVatCents ?? 0,
      usefulLifeMonths: input.usefulLifeMonths,
      residualValueCents,
      sourceTransactionId: input.sourceTransactionId ?? null,
      notes: input.notes?.trim() ?? "",
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return asset;
}

export function postFixedAssetDepreciation(
  db: AppDatabase,
  input: { assetId: number; periodStart: string; actorUserId: string },
) {
  return runInImmediateTransaction(db, () => {
    return postFixedAssetDepreciationInTransaction(db, input);
  });
}

function postFixedAssetDepreciationInTransaction(
  db: AppDatabase,
  input: { assetId: number; periodStart: string; actorUserId: string | null },
) {
  const asset = db.select().from(fixedAssets).where(eq(fixedAssets.id, input.assetId)).get();
  if (!asset) throw new BookingCommandError("Anlagegut nicht gefunden.");
  if (asset.status !== "active")
    throw new BookingCommandError("Für ein ausgeschiedenes Anlagegut kann keine AfA gebucht werden.");
  if (!/^\d{4}-\d{2}-01$/.test(input.periodStart)) throw new BookingCommandError("Ungültiger AfA-Monat.");
  const existing = db
    .select()
    .from(fixedAssetDepreciationEntries)
    .where(
      and(
        eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id),
        eq(fixedAssetDepreciationEntries.periodStart, input.periodStart),
      ),
    )
    .get();
  if (existing) return existing;
  const amountCents = monthlyDepreciationCents(asset, input.periodStart);
  if (amountCents <= 0) throw new BookingCommandError("Für diesen Monat ist keine AfA vorgesehen.");
  const periodEnd = monthDate(monthIndex(input.periodStart) + 1);
  const journalEntryId = appendJournalEntry(db, {
    kind: "depreciation",
    actorUserId: input.actorUserId,
    reason: `AfA: ${asset.assetNumber} · ${asset.name} · ${input.periodStart.slice(0, 7)}`,
    idempotencyKey: `fixed-asset-depreciation:${asset.id}:${input.periodStart}`,
    occurredAt: new Date(`${periodEnd}T00:00:00Z`),
    lines: [
      { account: "expense", amountCents },
      { account: asset.accumulatedDepreciationAccountCode, amountCents: -amountCents },
    ],
  });
  return db
    .insert(fixedAssetDepreciationEntries)
    .values({
      fixedAssetId: asset.id,
      periodStart: input.periodStart,
      periodEnd,
      amountCents,
      journalEntryId,
      createdByUserId: input.actorUserId,
      createdAt: new Date(),
    })
    .returning()
    .get();
}

export function createPrivateAssetContribution(
  db: AppDatabase,
  input: {
    name: string;
    assetType: "bike" | "equipment" | "other";
    acquisitionDate: string;
    inServiceDate: string;
    acquisitionCostCents: number;
    usefulLifeMonths: number;
    serialNumber?: string | null;
    notes?: string;
    actorUserId: string;
  },
) {
  return runInImmediateTransaction(db, () => {
    const asset = createFixedAsset(db, {
      ...input,
      acquisitionSource: "private_contribution",
      createdByUserId: input.actorUserId,
      inputVatCents: 0,
    });
    const journalEntryId = appendJournalEntry(db, {
      kind: "capital_contribution",
      actorUserId: input.actorUserId,
      reason: `Privateinlage: ${asset.assetNumber} · ${asset.name}`,
      lines: [
        { account: asset.assetAccountCode, amountCents: asset.acquisitionCostCents },
        { account: "equity", amountCents: -asset.acquisitionCostCents },
      ],
    });
    return { assetId: asset.id, journalEntryId };
  });
}

export function postDueFixedAssetDepreciation(
  db: AppDatabase,
  input: { throughMonth: string; actorUserId: string | null },
) {
  const through = `${input.throughMonth.trim().slice(0, 7)}-01`;
  if (!/^\d{4}-\d{2}-01$/.test(through)) throw new BookingCommandError("Ungültiger Abrechnungsmonat.");
  return runInImmediateTransaction(db, () => {
    const assets = db.select().from(fixedAssets).where(eq(fixedAssets.status, "active")).all();
    let posted = 0;
    for (const asset of assets) {
      for (const period of fixedAssetDepreciationSchedule(asset)) {
        if (period.periodStart > through) continue;
        const before = db
          .select({ id: fixedAssetDepreciationEntries.id })
          .from(fixedAssetDepreciationEntries)
          .where(
            and(
              eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id),
              eq(fixedAssetDepreciationEntries.periodStart, period.periodStart),
            ),
          )
          .get();
        if (before) continue;
        postFixedAssetDepreciationInTransaction(db, {
          assetId: asset.id,
          periodStart: period.periodStart,
          actorUserId: input.actorUserId,
        });
        posted += 1;
      }
    }
    return { posted };
  });
}

export function disposeFixedAsset(
  db: AppDatabase,
  input: {
    assetId: number;
    disposedAt: string;
    disposalProceedsCents: number;
    disposalProceedsVatCents?: number;
    actorUserId: string | null;
  },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.disposedAt))
    throw new BookingCommandError("Bitte gib ein gültiges Verkaufsdatum an.");
  if (!Number.isSafeInteger(input.disposalProceedsCents) || input.disposalProceedsCents < 0)
    throw new BookingCommandError("Der Verkaufserlös darf nicht negativ sein.");
  const vatCents = input.disposalProceedsVatCents ?? 0;
  if (!Number.isSafeInteger(vatCents) || vatCents < 0 || vatCents > input.disposalProceedsCents)
    throw new BookingCommandError("Die Umsatzsteuer muss zwischen 0 und dem Nettoerlös liegen.");

  return runInImmediateTransaction(db, () => {
    const asset = db.select().from(fixedAssets).where(eq(fixedAssets.id, input.assetId)).get();
    if (!asset) throw new BookingCommandError("Anlagegut nicht gefunden.");
    if (asset.status !== "active") throw new BookingCommandError("Dieses Anlagegut ist bereits ausgeschieden.");
    if (input.disposedAt < asset.acquisitionDate)
      throw new BookingCommandError("Das Verkaufsdatum darf nicht vor der Anschaffung liegen.");

    const through = `${input.disposedAt.slice(0, 7)}-01`;
    for (const period of fixedAssetDepreciationSchedule(asset)) {
      if (period.periodStart > through) continue;
      postFixedAssetDepreciationInTransaction(db, {
        assetId: asset.id,
        periodStart: period.periodStart,
        actorUserId: input.actorUserId,
      });
    }

    const depreciationCents = db
      .select({ amountCents: fixedAssetDepreciationEntries.amountCents })
      .from(fixedAssetDepreciationEntries)
      .where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id))
      .all()
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const bookValueCents = Math.max(0, asset.acquisitionCostCents - depreciationCents);
    const disposalLines = [
      depreciationCents > 0
        ? { account: asset.accumulatedDepreciationAccountCode, amountCents: depreciationCents }
        : null,
      { account: asset.assetAccountCode, amountCents: -asset.acquisitionCostCents },
      { account: "expense", amountCents: bookValueCents },
    ].filter((line): line is { account: string; amountCents: number } => line !== null);
    const journalEntryId = appendJournalEntry(db, {
      kind: "asset_disposal",
      actorUserId: input.actorUserId,
      reason: `Abgang: ${asset.assetNumber} · ${asset.name} · Verkauf`,
      idempotencyKey: `fixed-asset-disposal:${asset.id}`,
      occurredAt: new Date(`${input.disposedAt}T00:00:00Z`),
      lines: disposalLines,
    });
    const now = new Date();
    db.update(fixedAssets)
      .set({
        status: "disposed",
        disposedAt: input.disposedAt,
        disposalReason: "sold",
        disposalProceedsCents: input.disposalProceedsCents,
        disposalProceedsVatCents: vatCents,
        updatedAt: now,
      })
      .where(eq(fixedAssets.id, asset.id))
      .run();
    return { assetId: asset.id, bookValueCents, journalEntryId };
  });
}
