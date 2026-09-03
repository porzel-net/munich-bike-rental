import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { runInImmediateTransaction } from "../db/client";
import { appendJournalEntry } from "../bookings/ledger";
import { BookingCommandError } from "../bookings/errors";
import { isValidIsoDate, isValidIsoMonth } from "../bookings/validation";
import {
  accountingAccounts,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalLines,
} from "../db/schema";

function ensureFinancialAccountInChart(db: AppDatabase, account: typeof financialAccounts.$inferSelect) {
  const exists = db
    .select({ id: accountingAccounts.id })
    .from(accountingAccounts)
    .where(eq(accountingAccounts.code, account.code))
    .get();
  if (exists) return;
  db.insert(accountingAccounts)
    .values({
      code: account.code,
      name: account.name,
      accountType: account.type === "stripe_clearing" ? "clearing" : "asset",
      isSystem: true,
      isActive: true,
      notes: `Finanzkonto ${account.code}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
}

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
  if (!Number.isSafeInteger(asset.usefulLifeMonths) || asset.usefulLifeMonths < 1)
    throw new BookingCommandError("Die Nutzungsdauer muss mindestens einen Monat betragen.");
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
  if (!isValidIsoDate(input.acquisitionDate) || !isValidIsoDate(input.inServiceDate))
    throw new BookingCommandError("Bitte verwende gültige Anschaffungs- und Inbetriebnahmedaten.");
  if (input.acquisitionCostCents <= 0 || !Number.isSafeInteger(input.acquisitionCostCents))
    throw new BookingCommandError("Die Anschaffungskosten müssen größer als 0 sein.");
  const inputVatCents = input.inputVatCents ?? 0;
  if (!Number.isSafeInteger(inputVatCents) || inputVatCents < 0)
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
      inputVatCents,
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

export function updateFixedAsset(
  db: AppDatabase,
  input: {
    assetId: number;
    name: string;
    assetType: "bike" | "equipment" | "other";
    serialNumber?: string | null;
    inServiceDate: string;
    usefulLifeMonths: number;
    notes?: string;
    actorUserId: string | null;
  },
) {
  return runInImmediateTransaction(db, () => {
    const asset = db.select().from(fixedAssets).where(eq(fixedAssets.id, input.assetId)).get();
    if (!asset) throw new BookingCommandError("Anlagegut nicht gefunden.");
    if (asset.status !== "active")
      throw new BookingCommandError("Ausgeschiedene Anlagegüter können nicht geändert werden.");

    const name = input.name.trim();
    if (!name) throw new BookingCommandError("Bitte benenne das Anlagegut.");
    if (!isValidIsoDate(input.inServiceDate))
      throw new BookingCommandError("Bitte gib ein gültiges Inbetriebnahmedatum an.");
    if (input.inServiceDate < asset.acquisitionDate)
      throw new BookingCommandError("Die Inbetriebnahme darf nicht vor der Anschaffung liegen.");
    if (!Number.isSafeInteger(input.usefulLifeMonths) || input.usefulLifeMonths < 1)
      throw new BookingCommandError("Die Nutzungsdauer muss mindestens einen Monat betragen.");

    const scheduleChanged =
      input.inServiceDate !== asset.inServiceDate || input.usefulLifeMonths !== asset.usefulLifeMonths;
    if (scheduleChanged) {
      const depreciationEntries = db
        .select()
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id))
        .all();
      for (const entry of depreciationEntries) {
        const lines = db
          .select({ account: journalLines.account, amountCents: journalLines.amountCents })
          .from(journalLines)
          .where(eq(journalLines.entryId, entry.journalEntryId))
          .all();
        if (!lines.length) throw new BookingCommandError("Die bestehende AfA konnte nicht korrigiert werden.");
        appendJournalEntry(db, {
          financialTransactionId: asset.sourceTransactionId,
          actorUserId: input.actorUserId,
          kind: "correction",
          reason: `AfA korrigiert: ${asset.assetNumber} · ${asset.name}`,
          reversesEntryId: entry.journalEntryId,
          lines: lines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
        });
      }
      if (depreciationEntries.length) {
        db.delete(fixedAssetDepreciationEntries).where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id)).run();
      }
    }

    return db
      .update(fixedAssets)
      .set({
        name,
        assetType: input.assetType,
        serialNumber: input.serialNumber?.trim() || null,
        inServiceDate: input.inServiceDate,
        usefulLifeMonths: input.usefulLifeMonths,
        notes: input.notes?.trim() ?? asset.notes,
        updatedAt: new Date(),
      })
      .where(eq(fixedAssets.id, asset.id))
      .returning()
      .get();
  });
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
  if (!isValidIsoMonth(input.periodStart.slice(0, 7)) || !input.periodStart.endsWith("-01"))
    throw new BookingCommandError("Ungültiger AfA-Monat.");
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
  if (!isValidIsoMonth(input.throughMonth.trim())) throw new BookingCommandError("Ungültiger Abrechnungsmonat.");
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
    financialAccountId: number;
    disposedAt: string;
    disposalProceedsCents: number;
    disposalProceedsVatCents?: number;
    actorUserId: string | null;
  },
) {
  if (!isValidIsoDate(input.disposedAt)) throw new BookingCommandError("Bitte gib ein gültiges Verkaufsdatum an.");
  if (!Number.isSafeInteger(input.disposalProceedsCents) || input.disposalProceedsCents < 0)
    throw new BookingCommandError("Der Nettoverkaufspreis darf nicht negativ sein.");
  const vatCents = input.disposalProceedsVatCents ?? 0;
  if (!Number.isSafeInteger(vatCents) || vatCents < 0 || vatCents > input.disposalProceedsCents)
    throw new BookingCommandError("Die Umsatzsteuer muss zwischen 0 und dem Nettoverkaufspreis liegen.");

  return runInImmediateTransaction(db, () => {
    const asset = db.select().from(fixedAssets).where(eq(fixedAssets.id, input.assetId)).get();
    if (!asset) throw new BookingCommandError("Anlagegut nicht gefunden.");
    if (asset.status !== "active") throw new BookingCommandError("Dieses Anlagegut ist bereits ausgeschieden.");
    if (input.disposedAt < asset.acquisitionDate)
      throw new BookingCommandError("Das Verkaufsdatum darf nicht vor der Anschaffung liegen.");

    const account = db.select().from(financialAccounts).where(eq(financialAccounts.id, input.financialAccountId)).get();
    if (!account || account.status !== "active") throw new BookingCommandError("Das Zahlungskonto ist nicht aktiv.");
    if (account.currency !== "EUR") throw new BookingCommandError("Verkäufe werden aktuell nur in EUR unterstützt.");
    ensureFinancialAccountInChart(db, account);

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
    const removalEntryId = appendJournalEntry(db, {
      kind: "asset_disposal",
      actorUserId: input.actorUserId,
      reason: `Abgang: ${asset.assetNumber} · ${asset.name}`,
      idempotencyKey: `fixed-asset-disposal:${asset.id}`,
      occurredAt: new Date(`${input.disposedAt}T00:00:00Z`),
      lines: [
        depreciationCents > 0
          ? { account: asset.accumulatedDepreciationAccountCode, amountCents: depreciationCents }
          : null,
        { account: asset.assetAccountCode, amountCents: -asset.acquisitionCostCents },
        { account: "expense", amountCents: bookValueCents },
      ].filter((line): line is { account: string; amountCents: number } => line !== null),
    });

    let disposalTransactionId: number | null = null;
    let saleEntryId: number | null = null;
    if (input.disposalProceedsCents > 0 || vatCents > 0) {
      const revenueCategory = db
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.code, "other_operating_income"))
        .get();
      const outputVatCategory = db
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.code, "output_vat"))
        .get();
      if (!revenueCategory || !revenueCategory.isActive || revenueCategory.euerTreatment !== "income")
        throw new BookingCommandError("Die EÜR-Kategorie für Anlagenverkäufe ist nicht eingerichtet.");
      if (
        vatCents > 0 &&
        (!outputVatCategory || !outputVatCategory.isActive || outputVatCategory.euerTreatment !== "output_vat")
      )
        throw new BookingCommandError("Die Umsatzsteuerkategorie für Anlagenverkäufe ist nicht eingerichtet.");

      const grossProceedsCents = input.disposalProceedsCents + vatCents;
      if (!Number.isSafeInteger(grossProceedsCents) || grossProceedsCents <= 0)
        throw new BookingCommandError("Der Bruttoverkaufserlös ist ungültig.");
      const now = new Date();
      const transaction = db
        .insert(financialTransactions)
        .values({
          financialAccountId: account.id,
          source: account.type === "cash" ? "cash" : "manual",
          provider: "manual_asset_disposal",
          kind: "income",
          status: "imported",
          amountCents: grossProceedsCents,
          grossAmountCents: grossProceedsCents,
          netAmountCents: grossProceedsCents,
          currency: account.currency,
          bookedAt: input.disposedAt,
          description: `Verkauf Anlagegut ${asset.assetNumber} · ${asset.name}`,
          metadataJson: JSON.stringify({
            fixedAssetId: asset.id,
            proceedsNetCents: input.disposalProceedsCents,
            vatCents,
          }),
          importedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: financialTransactions.id })
        .get();
      disposalTransactionId = transaction.id;
      saleEntryId = appendJournalEntry(db, {
        kind: "payment_received",
        financialTransactionId: transaction.id,
        actorUserId: input.actorUserId,
        reason: `Verkaufserlös: ${asset.assetNumber} · ${asset.name}`,
        idempotencyKey: `fixed-asset-sale:${asset.id}`,
        occurredAt: new Date(`${input.disposedAt}T00:00:00Z`),
        lines: [
          { account: account.code, amountCents: grossProceedsCents },
          { account: revenueCategory.accountCode, amountCents: -input.disposalProceedsCents },
          ...(vatCents > 0 ? [{ account: outputVatCategory!.accountCode, amountCents: -vatCents }] : []),
        ],
      });
      const allocations = [
        {
          transactionId: transaction.id,
          categoryId: revenueCategory.id,
          allocationKind: "revenue" as const,
          amountCents: input.disposalProceedsCents,
        },
        ...(vatCents > 0
          ? [
              {
                transactionId: transaction.id,
                categoryId: outputVatCategory!.id,
                allocationKind: "tax" as const,
                amountCents: vatCents,
              },
            ]
          : []),
      ];
      if (allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) !== grossProceedsCents)
        throw new BookingCommandError("Der Verkaufserlös konnte nicht korrekt aufgeteilt werden.");
      db.insert(financialTransactionAllocations)
        .values(
          allocations.map((allocation) => ({
            ...allocation,
            fixedAssetId: asset.id,
            matchMethod: "manual" as const,
            journalEntryId: saleEntryId,
            note: `Verkaufserlös für ${asset.assetNumber}`,
            matchedByUserId: input.actorUserId,
            matchedAt: now,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .run();
      db.update(financialTransactions)
        .set({ status: "posted", reconciledAt: now, reconciledByUserId: input.actorUserId, updatedAt: now })
        .where(eq(financialTransactions.id, transaction.id))
        .run();
    }

    const now = new Date();
    db.update(fixedAssets)
      .set({
        status: "disposed",
        disposedAt: input.disposedAt,
        disposalReason: "sold",
        disposalProceedsCents: input.disposalProceedsCents,
        disposalProceedsVatCents: vatCents,
        disposalTransactionId,
        updatedAt: now,
      })
      .where(eq(fixedAssets.id, asset.id))
      .run();
    return { assetId: asset.id, bookValueCents, journalEntryId: removalEntryId, disposalTransactionId, saleEntryId };
  });
}
