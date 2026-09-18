import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";

import { recordAdminAuditEvent } from "../auth/audit";
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
  fixedAssetMethods,
  fixedAssetOriginalConditions,
  fixedAssetPrivateUseTypes,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalEntries,
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

type FixedAssetMethod = (typeof fixedAssetMethods)[number];
type FixedAssetOriginalCondition = (typeof fixedAssetOriginalConditions)[number];
type FixedAssetPrivateUseType = (typeof fixedAssetPrivateUseTypes)[number];

type DepreciationAsset = Pick<
  typeof fixedAssets.$inferSelect,
  "acquisitionCostCents" | "residualValueCents" | "usefulLifeMonths" | "inServiceDate"
> & {
  acquisitionDate?: string;
  originalAcquisitionDate?: string | null;
  originalUsefulLifeMonths?: number | null;
  acquisitionSource?: "transaction" | "private_contribution";
  method?: FixedAssetMethod;
  degressiveRateBps?: number | null;
};

/** Returns the maximum statutory declining-balance rate in basis points. */
export function getMaximumDegressiveRateBps(input: { acquisitionDate: string; usefulLifeMonths: number }) {
  if (!Number.isSafeInteger(input.usefulLifeMonths) || input.usefulLifeMonths < 1) return null;

  const rule =
    input.acquisitionDate >= "2025-07-01" && input.acquisitionDate < "2028-01-01"
      ? { factor: 3, capBps: 3_000 }
      : input.acquisitionDate >= "2024-04-01" && input.acquisitionDate < "2025-01-01"
        ? { factor: 2, capBps: 2_000 }
        : null;
  if (!rule) return null;
  return Math.min(rule.capBps, Math.floor((rule.factor * 120_000) / input.usefulLifeMonths));
}

function resolveDegressiveRateBps(input: {
  method: FixedAssetMethod;
  acquisitionDate: string;
  originalAcquisitionDate?: string | null;
  usefulLifeMonths: number;
  statutoryUsefulLifeMonths?: number;
  acquisitionSource?: "transaction" | "private_contribution";
  degressiveRateBps?: number | null;
}) {
  if (input.method === "straight_line") return null;
  const eligibilityDate =
    input.acquisitionSource === "private_contribution" ? input.originalAcquisitionDate : input.acquisitionDate;
  if (!eligibilityDate)
    throw new BookingCommandError(
      "Für eine degressive Privateinlage muss das ursprüngliche Anschaffungsdatum hinterlegt sein.",
    );
  const maximum = getMaximumDegressiveRateBps({
    acquisitionDate: eligibilityDate,
    usefulLifeMonths: input.statutoryUsefulLifeMonths ?? input.usefulLifeMonths,
  });
  if (maximum === null)
    throw new BookingCommandError(
      "Für dieses Anschaffungsdatum ist keine degressive AfA nach § 7 Abs. 2 EStG zulässig.",
    );
  const rate = input.degressiveRateBps ?? maximum;
  if (!Number.isSafeInteger(rate) || rate < 1 || rate > maximum)
    throw new BookingCommandError("Der degressive AfA-Satz überschreitet den gesetzlich zulässigen Höchstsatz.");
  return rate;
}

function depreciationMethod(asset: DepreciationAsset) {
  return asset.method ?? "straight_line";
}

function depreciationRateBps(asset: DepreciationAsset) {
  const method = depreciationMethod(asset);
  if (method === "straight_line") return null;
  if (!asset.acquisitionDate) throw new BookingCommandError("Für degressive AfA fehlt das Anschaffungsdatum.");
  return resolveDegressiveRateBps({
    method,
    acquisitionDate: asset.acquisitionDate,
    originalAcquisitionDate: asset.originalAcquisitionDate,
    usefulLifeMonths: asset.usefulLifeMonths,
    statutoryUsefulLifeMonths: asset.originalUsefulLifeMonths ?? undefined,
    acquisitionSource: asset.acquisitionSource,
    degressiveRateBps: asset.degressiveRateBps,
  });
}

function straightLineDepreciationCents(asset: DepreciationAsset, periodStart: string) {
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

function calendarDateAfterYears(value: string, years: number) {
  const [year, month, day] = value.split("-").map(Number);
  const targetYear = year + years;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDayOfTargetMonth)).padStart(2, "0")}`;
}

function calculatePreEntryDepreciationCents(input: {
  originalAcquisitionDate: string;
  contributionDate: string;
  originalAcquisitionCostCents: number;
  originalUsefulLifeMonths: number;
}) {
  const monthsBeforeContribution = monthIndex(input.contributionDate) - monthIndex(input.originalAcquisitionDate);
  if (monthsBeforeContribution <= 0) return 0;
  const originalAsset: DepreciationAsset = {
    acquisitionCostCents: input.originalAcquisitionCostCents,
    residualValueCents: 0,
    usefulLifeMonths: input.originalUsefulLifeMonths,
    inServiceDate: input.originalAcquisitionDate,
  };
  return Math.min(
    input.originalAcquisitionCostCents,
    Array.from({ length: monthsBeforeContribution }, (_, index) =>
      straightLineDepreciationCents(originalAsset, monthDate(monthIndex(input.originalAcquisitionDate) + index)),
    ).reduce((sum, amount) => sum + amount, 0),
  );
}

function resolvePrivateContributionDetails(input: {
  originalAcquisitionDate: string | null;
  originalAcquisitionCostCents: number | null;
  originalUsefulLifeMonths: number | null;
  originalCondition: FixedAssetOriginalCondition | null;
  privateUseType: FixedAssetPrivateUseType | null;
  contributionDate: string;
  entryValueCents: number;
  remainingUsefulLifeMonths: number;
}) {
  if (!input.originalAcquisitionDate)
    throw new BookingCommandError("Für eine Privateinlage muss das ursprüngliche Anschaffungsdatum hinterlegt sein.");
  if (!isValidIsoDate(input.originalAcquisitionDate))
    throw new BookingCommandError("Bitte gib ein gültiges ursprüngliches Anschaffungsdatum an.");
  if (input.originalAcquisitionDate > input.contributionDate)
    throw new BookingCommandError("Das ursprüngliche Anschaffungsdatum darf nicht nach der Einlage liegen.");
  if (
    !Number.isSafeInteger(input.originalAcquisitionCostCents) ||
    input.originalAcquisitionCostCents === null ||
    input.originalAcquisitionCostCents <= 0
  )
    throw new BookingCommandError(
      "Für eine Privateinlage müssen die ursprünglichen Anschaffungskosten hinterlegt sein.",
    );
  if (
    !Number.isSafeInteger(input.originalUsefulLifeMonths) ||
    input.originalUsefulLifeMonths === null ||
    input.originalUsefulLifeMonths < 1
  )
    throw new BookingCommandError("Für eine Privateinlage muss die ursprüngliche Nutzungsdauer hinterlegt sein.");
  if (!fixedAssetPrivateUseTypes.includes(input.privateUseType as FixedAssetPrivateUseType))
    throw new BookingCommandError("Für eine Privateinlage muss die vorherige Nutzung angegeben werden.");
  if (!fixedAssetOriginalConditions.includes(input.originalCondition as FixedAssetOriginalCondition))
    throw new BookingCommandError(
      "Für eine Privateinlage muss angegeben werden, ob das Anlagegut neu oder gebraucht war.",
    );

  const monthsBeforeContribution = monthIndex(input.contributionDate) - monthIndex(input.originalAcquisitionDate);
  const maximumRemainingLife = input.originalUsefulLifeMonths - monthsBeforeContribution;
  if (maximumRemainingLife < 1 || input.remainingUsefulLifeMonths > maximumRemainingLife)
    throw new BookingCommandError(
      "Die Restnutzungsdauer der Privateinlage darf die verbleibende ursprüngliche Nutzungsdauer nicht überschreiten.",
    );

  const preEntryDepreciationCents = calculatePreEntryDepreciationCents({
    originalAcquisitionDate: input.originalAcquisitionDate,
    contributionDate: input.contributionDate,
    originalAcquisitionCostCents: input.originalAcquisitionCostCents,
    originalUsefulLifeMonths: input.originalUsefulLifeMonths,
  });
  const carriedForwardCostCents = input.originalAcquisitionCostCents - preEntryDepreciationCents;
  if (input.contributionDate < calendarDateAfterYears(input.originalAcquisitionDate, 3)) {
    if (input.entryValueCents > carriedForwardCostCents)
      throw new BookingCommandError(
        `Der Einlagewert darf innerhalb von drei Jahren die fortgeführten Anschaffungskosten von ${(carriedForwardCostCents / 100).toFixed(2)} € nicht überschreiten.`,
      );
  }

  return {
    originalAcquisitionDate: input.originalAcquisitionDate,
    originalAcquisitionCostCents: input.originalAcquisitionCostCents,
    originalUsefulLifeMonths: input.originalUsefulLifeMonths,
    originalCondition: input.originalCondition as FixedAssetOriginalCondition,
    privateUseType: input.privateUseType as FixedAssetPrivateUseType,
    preEntryDepreciationCents,
  };
}

function splitAcrossMonths(amountCents: number, monthCount: number) {
  const base = Math.floor(amountCents / monthCount);
  return Array.from({ length: monthCount }, (_, index) =>
    index === monthCount - 1 ? amountCents - base * (monthCount - 1) : base,
  );
}

function decliningBalanceDepreciationSchedule(asset: DepreciationAsset) {
  const rateBps = depreciationRateBps(asset);
  if (rateBps === null) throw new BookingCommandError("Für dieses Anlagegut ist keine degressive AfA hinterlegt.");

  let cursor = monthIndex(asset.inServiceDate);
  let remainingLifeMonths = asset.usefulLifeMonths;
  let remainingDepreciableCents = asset.acquisitionCostCents - asset.residualValueCents;
  let declining = true;
  const schedule: Array<{ periodStart: string; periodEnd: string; amountCents: number }> = [];

  while (remainingLifeMonths > 0 && remainingDepreciableCents > 0) {
    const monthsUntilYearEnd = 12 - (cursor % 12);
    const segmentMonths = Math.min(monthsUntilYearEnd, remainingLifeMonths);
    const decliningAnnualCents = Math.min(
      remainingDepreciableCents,
      Math.floor(((asset.residualValueCents + remainingDepreciableCents) * rateBps) / 10_000),
    );

    // The transition is evaluated at the beginning of a tax year. This is
    // the same comparison used in the BMF example: switch when linear AfA
    // for the remaining life exceeds the declining annual amount.
    if (declining && decliningAnnualCents * remainingLifeMonths < remainingDepreciableCents * 12) {
      declining = false;
    }

    const segmentAmountCents = declining
      ? Math.min(remainingDepreciableCents, Math.floor((decliningAnnualCents * segmentMonths) / 12))
      : segmentMonths === remainingLifeMonths
        ? remainingDepreciableCents
        : Math.floor((remainingDepreciableCents * segmentMonths) / remainingLifeMonths);
    const monthlyAmounts = splitAcrossMonths(segmentAmountCents, segmentMonths);
    for (let index = 0; index < segmentMonths; index += 1) {
      const periodStart = monthDate(cursor + index);
      schedule.push({
        periodStart,
        periodEnd: monthDate(cursor + index + 1),
        amountCents: monthlyAmounts[index],
      });
    }
    cursor += segmentMonths;
    remainingLifeMonths -= segmentMonths;
    remainingDepreciableCents -= segmentAmountCents;
  }

  return schedule.filter((entry) => entry.amountCents > 0);
}

export function monthlyDepreciationCents(asset: DepreciationAsset, periodStart: string) {
  if (depreciationMethod(asset) === "straight_line") return straightLineDepreciationCents(asset, periodStart);
  return (
    decliningBalanceDepreciationSchedule(asset).find((entry) => entry.periodStart === periodStart)?.amountCents ?? 0
  );
}

export function fixedAssetDepreciationSchedule(asset: DepreciationAsset) {
  if (depreciationMethod(asset) === "declining_balance") return decliningBalanceDepreciationSchedule(asset);
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
    originalAcquisitionDate?: string | null;
    originalAcquisitionCostCents?: number | null;
    originalUsefulLifeMonths?: number | null;
    originalCondition?: FixedAssetOriginalCondition | null;
    privateUseType?: FixedAssetPrivateUseType | null;
    inServiceDate: string;
    acquisitionCostCents: number;
    inputVatCents?: number;
    usefulLifeMonths: number;
    method?: FixedAssetMethod;
    degressiveRateBps?: number | null;
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
  const acquisitionSource = input.acquisitionSource ?? "transaction";
  const originalAcquisitionDate =
    acquisitionSource === "private_contribution" ? (input.originalAcquisitionDate ?? null) : null;
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
    throw new BookingCommandError("Die Inbetriebnahme darf nicht vor der Anschaffung oder Einlage liegen.");
  const method = input.method ?? "straight_line";
  if (acquisitionSource === "private_contribution" && method === "declining_balance") {
    // Check the statutory acquisition window before the historical-cost cap so
    // an outdated original purchase date gets a precise legal error.
    resolveDegressiveRateBps({
      method,
      acquisitionDate: input.acquisitionDate,
      originalAcquisitionDate,
      usefulLifeMonths: input.usefulLifeMonths,
      statutoryUsefulLifeMonths: input.originalUsefulLifeMonths ?? undefined,
      acquisitionSource,
      degressiveRateBps: input.degressiveRateBps,
    });
  }
  const privateContributionDetails =
    acquisitionSource === "private_contribution"
      ? resolvePrivateContributionDetails({
          originalAcquisitionDate,
          originalAcquisitionCostCents: input.originalAcquisitionCostCents ?? null,
          originalUsefulLifeMonths: input.originalUsefulLifeMonths ?? null,
          originalCondition: input.originalCondition ?? null,
          privateUseType: input.privateUseType ?? null,
          contributionDate: input.acquisitionDate,
          entryValueCents: input.acquisitionCostCents,
          remainingUsefulLifeMonths: input.usefulLifeMonths,
        })
      : null;
  const degressiveRateBps = resolveDegressiveRateBps({
    method,
    acquisitionDate: input.acquisitionDate,
    originalAcquisitionDate,
    usefulLifeMonths: input.usefulLifeMonths,
    statutoryUsefulLifeMonths: privateContributionDetails?.originalUsefulLifeMonths,
    acquisitionSource,
    degressiveRateBps: input.degressiveRateBps,
  });

  const now = new Date();
  const asset = db
    .insert(fixedAssets)
    .values({
      assetNumber: `ANL-${new Date(`${input.acquisitionDate}T00:00:00Z`).getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      assetType: input.assetType,
      acquisitionSource,
      serialNumber: input.serialNumber?.trim() || null,
      acquisitionDate: input.acquisitionDate,
      originalAcquisitionDate,
      originalAcquisitionCostCents: privateContributionDetails?.originalAcquisitionCostCents ?? null,
      originalUsefulLifeMonths: privateContributionDetails?.originalUsefulLifeMonths ?? null,
      originalCondition: privateContributionDetails?.originalCondition ?? null,
      privateUseType: privateContributionDetails?.privateUseType ?? null,
      preEntryDepreciationCents: privateContributionDetails?.preEntryDepreciationCents ?? 0,
      inServiceDate: input.inServiceDate,
      acquisitionCostCents: input.acquisitionCostCents,
      inputVatCents,
      usefulLifeMonths: input.usefulLifeMonths,
      method,
      degressiveRateBps,
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
    originalAcquisitionDate?: string | null;
    originalAcquisitionCostCents?: number | null;
    originalUsefulLifeMonths?: number | null;
    originalCondition?: FixedAssetOriginalCondition | null;
    privateUseType?: FixedAssetPrivateUseType | null;
    method?: FixedAssetMethod;
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

    const method = input.method ?? asset.method;
    const originalAcquisitionDate =
      asset.acquisitionSource === "private_contribution"
        ? (input.originalAcquisitionDate ?? asset.originalAcquisitionDate)
        : null;
    const originalAcquisitionCostCents =
      asset.acquisitionSource === "private_contribution"
        ? (input.originalAcquisitionCostCents ?? asset.originalAcquisitionCostCents)
        : null;
    const originalUsefulLifeMonths =
      asset.acquisitionSource === "private_contribution"
        ? (input.originalUsefulLifeMonths ?? asset.originalUsefulLifeMonths)
        : null;
    const originalCondition =
      asset.acquisitionSource === "private_contribution" ? (input.originalCondition ?? asset.originalCondition) : null;
    const privateUseType =
      asset.acquisitionSource === "private_contribution" ? (input.privateUseType ?? asset.privateUseType) : null;
    const privateMetadataWasProvided = [
      input.originalAcquisitionDate,
      input.originalAcquisitionCostCents,
      input.originalUsefulLifeMonths,
      input.originalCondition,
      input.privateUseType,
    ].some((value) => value !== undefined && value !== null);
    const privateContributionDetails =
      asset.acquisitionSource === "private_contribution" &&
      (method === "declining_balance" || privateMetadataWasProvided)
        ? resolvePrivateContributionDetails({
            originalAcquisitionDate,
            originalAcquisitionCostCents,
            originalUsefulLifeMonths,
            originalCondition,
            privateUseType,
            contributionDate: asset.acquisitionDate,
            entryValueCents: asset.acquisitionCostCents,
            remainingUsefulLifeMonths: input.usefulLifeMonths,
          })
        : null;
    const degressiveRateBps = resolveDegressiveRateBps({
      method,
      acquisitionDate: asset.acquisitionDate,
      originalAcquisitionDate,
      usefulLifeMonths: input.usefulLifeMonths,
      statutoryUsefulLifeMonths:
        privateContributionDetails?.originalUsefulLifeMonths ?? asset.originalUsefulLifeMonths ?? undefined,
      acquisitionSource: asset.acquisitionSource,
      degressiveRateBps:
        method === "declining_balance" &&
        input.usefulLifeMonths === asset.usefulLifeMonths &&
        originalAcquisitionDate === asset.originalAcquisitionDate &&
        originalUsefulLifeMonths === asset.originalUsefulLifeMonths
          ? asset.degressiveRateBps
          : null,
    });

    const scheduleChanged =
      input.inServiceDate !== asset.inServiceDate ||
      input.usefulLifeMonths !== asset.usefulLifeMonths ||
      method !== asset.method ||
      degressiveRateBps !== asset.degressiveRateBps;
    const depreciationRevision = scheduleChanged ? asset.depreciationRevision + 1 : asset.depreciationRevision;
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
        originalAcquisitionDate: originalAcquisitionDate ?? null,
        originalAcquisitionCostCents:
          privateContributionDetails?.originalAcquisitionCostCents ?? originalAcquisitionCostCents,
        originalUsefulLifeMonths: privateContributionDetails?.originalUsefulLifeMonths ?? originalUsefulLifeMonths,
        originalCondition: privateContributionDetails?.originalCondition ?? originalCondition,
        privateUseType: privateContributionDetails?.privateUseType ?? privateUseType,
        preEntryDepreciationCents:
          privateContributionDetails?.preEntryDepreciationCents ?? asset.preEntryDepreciationCents,
        method,
        degressiveRateBps,
        depreciationRevision,
        notes: input.notes?.trim() ?? asset.notes,
        updatedAt: new Date(),
      })
      .where(eq(fixedAssets.id, asset.id))
      .returning()
      .get();
  });
}

/**
 * Removes an independently recorded private contribution from the asset register.
 * The append-only journal is preserved by posting correction entries for the
 * contribution and every already posted depreciation entry.
 */
export function deletePrivateContributionFixedAsset(db: AppDatabase, input: { assetId: number; actorUserId: string }) {
  return runInImmediateTransaction(db, () => {
    const asset = db.select().from(fixedAssets).where(eq(fixedAssets.id, input.assetId)).get();
    if (!asset) throw new BookingCommandError("Anlagegut nicht gefunden.");
    if (asset.status !== "active")
      throw new BookingCommandError("Ausgeschiedene Anlagegüter können nicht gelöscht werden.");
    if (asset.acquisitionSource !== "private_contribution" || asset.sourceTransactionId !== null)
      throw new BookingCommandError(
        "Nur unabhängig erfasste Privateinlagen können gelöscht werden. Transaktionsgebundene Anlagegüter müssen über die Finanztransaktion korrigiert werden.",
      );

    const linkedAllocation = db
      .select({ id: financialTransactionAllocations.id })
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.fixedAssetId, asset.id))
      .get();
    if (linkedAllocation)
      throw new BookingCommandError(
        "Dieses Anlagegut ist noch mit einer Finanzbuchung verknüpft und kann nicht gelöscht werden.",
      );

    const acquisitionEntries = db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.kind, "capital_contribution"),
          like(journalEntries.reason, `Privateinlage: ${asset.assetNumber} ·%`),
        ),
      )
      .all();
    if (acquisitionEntries.length !== 1)
      throw new BookingCommandError(
        "Die zugehörige Privateinlage konnte nicht eindeutig gefunden werden. Das Anlagegut wurde nicht gelöscht.",
      );

    const depreciationEntries = db
      .select()
      .from(fixedAssetDepreciationEntries)
      .where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id))
      .all();
    const entriesToReverse = [...depreciationEntries.map((entry) => entry.journalEntryId), acquisitionEntries[0].id];
    const now = new Date();
    for (const journalEntryId of entriesToReverse) {
      const lines = db
        .select({ account: journalLines.account, amountCents: journalLines.amountCents })
        .from(journalLines)
        .where(eq(journalLines.entryId, journalEntryId))
        .all();
      if (!lines.length) throw new BookingCommandError("Ein zugehöriger Journalposten ist unvollständig.");
      appendJournalEntry(db, {
        actorUserId: input.actorUserId,
        kind: "correction",
        reason: `Anlagegut gelöscht: ${asset.assetNumber} · ${asset.name}`,
        reversesEntryId: journalEntryId,
        occurredAt: now,
        lines: lines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
      });
    }

    db.delete(fixedAssetDepreciationEntries).where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id)).run();
    db.delete(fixedAssets).where(eq(fixedAssets.id, asset.id)).run();
    recordAdminAuditEvent(db, {
      actorUserId: input.actorUserId,
      action: "fixed_asset_deleted",
      targetType: "fixed_asset",
      targetId: asset.id,
      metadata: {
        assetNumber: asset.assetNumber,
        acquisitionSource: asset.acquisitionSource,
        reversedJournalEntryCount: entriesToReverse.length,
      },
    });
    return { assetId: asset.id, reversedJournalEntryCount: entriesToReverse.length };
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
    idempotencyKey: `fixed-asset-depreciation:${asset.id}:${asset.depreciationRevision}:${input.periodStart}`,
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
    originalAcquisitionDate: string;
    originalAcquisitionCostCents: number;
    originalUsefulLifeMonths: number;
    originalCondition: FixedAssetOriginalCondition;
    privateUseType: FixedAssetPrivateUseType;
    contributionDate: string;
    inServiceDate: string;
    acquisitionCostCents: number;
    usefulLifeMonths: number;
    method?: FixedAssetMethod;
    degressiveRateBps?: number | null;
    serialNumber?: string | null;
    notes?: string;
    actorUserId: string;
  },
) {
  return runInImmediateTransaction(db, () => {
    const asset = createFixedAsset(db, {
      ...input,
      acquisitionDate: input.contributionDate,
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
