import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accountingAccounts,
  financialAccounts,
  financialAllocationKinds,
  financialCategories,
  fixedAssets,
  financialTransactionAllocations,
  financialTransactions,
  journalLines,
  bookings,
} from "../db/schema";
import { runInImmediateTransaction } from "../db/client";
import { appendJournalEntry, getReceivedPaymentCents, getReceivableStatus, hasBookingCharge } from "../bookings/ledger";
import { BookingCommandError } from "../bookings/errors";
import { createFixedAsset } from "./fixed-assets";
import { getActiveFinancialCategoryByCode, getBookingRevenueCategory } from "./categories";

type JournalKind = Parameters<typeof appendJournalEntry>[1]["kind"];
type AllocationKind = (typeof financialAllocationKinds)[number];
type AllocationPart = {
  category: typeof financialCategories.$inferSelect;
  amountCents: number;
  allocationKind: AllocationKind;
};

function journalKindForTransaction(
  transaction: typeof financialTransactions.$inferSelect,
  category: typeof financialCategories.$inferSelect,
): JournalKind {
  if (category.categoryType === "transfer") return "bank_transfer";
  if (category.categoryType === "fee" || transaction.kind === "bank_fee") return "bank_fee";
  if (category.categoryType === "tax" || transaction.kind === "tax_payment") return "tax_payment";
  if (transaction.kind === "refund" && category.euerTreatment === "income") return "refund_issued";
  return transaction.amountCents < 0 ? "expense" : "payment_received";
}

function allocationKindForCategory(category: typeof financialCategories.$inferSelect) {
  switch (category.euerTreatment) {
    case "income":
      return "revenue";
    case "asset_acquisition":
      return "asset_acquisition";
    case "transfer":
      return "transfer";
    case "input_vat":
    case "output_vat":
    case "tax_payment":
      return "tax";
    case "expense":
      return category.categoryType === "fee" ? "fee" : "expense";
    default:
      return "other";
  }
}

function assertCategoryDirection(
  transaction: typeof financialTransactions.$inferSelect,
  category: typeof financialCategories.$inferSelect,
) {
  if (category.code === "unclassified")
    throw new BookingCommandError("Ungeklärte Transaktionen müssen zuerst geklärt werden.");
  if (category.euerTreatment === "needs_review")
    throw new BookingCommandError(
      "Die gewählte Kategorie hat noch keine konkrete EÜR-Zuordnung. Bitte wähle eine geklärte Kategorie.",
    );
  if (["income", "output_vat"].includes(category.euerTreatment)) {
    const isIncomeRefund = transaction.kind === "refund" && category.euerTreatment === "income";
    if ((isIncomeRefund && transaction.amountCents >= 0) || (!isIncomeRefund && transaction.amountCents <= 0))
      throw new BookingCommandError(
        isIncomeRefund
          ? "Eine Erstattung muss als negativer Zahlungsausgang erfasst werden."
          : "Diese Kategorie passt nur zu einem Zahlungseingang.",
      );
  }
  if (
    ["expense", "fee", "tax_payment", "input_vat", "asset_acquisition"].includes(category.euerTreatment) &&
    transaction.amountCents >= 0
  )
    throw new BookingCommandError("Diese Kategorie passt nur zu einer Kontobelastung.");
}

function ensureFinancialAccountInChart(db: AppDatabase, account: typeof financialAccounts.$inferSelect) {
  const existing = db
    .select({ id: accountingAccounts.id })
    .from(accountingAccounts)
    .where(eq(accountingAccounts.code, account.code))
    .get();
  if (existing) return;
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

function ensureAccountingAccount(db: AppDatabase, accountCode: string) {
  const account = db
    .select({ code: accountingAccounts.code, isActive: accountingAccounts.isActive })
    .from(accountingAccounts)
    .where(eq(accountingAccounts.code, accountCode))
    .get();
  if (!account) throw new BookingCommandError(`Das Buchungskonto ${accountCode} ist nicht eingerichtet.`);
  if (!account.isActive) throw new BookingCommandError(`Das Buchungskonto ${accountCode} ist nicht aktiv.`);
}

function reverseJournalEntryForCorrection(
  db: AppDatabase,
  allocation: typeof financialTransactionAllocations.$inferSelect,
  input: { bookingId: number; transactionId: number; actorUserId: string; reason: string },
) {
  if (!allocation.journalEntryId)
    throw new BookingCommandError("Die bestehende Zahlungszuordnung hat keinen zugehörigen Journalposten.");
  const lines = db
    .select({ account: journalLines.account, amountCents: journalLines.amountCents })
    .from(journalLines)
    .where(eq(journalLines.entryId, allocation.journalEntryId))
    .all();
  if (!lines.length) throw new BookingCommandError("Der bestehende Journalposten konnte nicht korrigiert werden.");
  return appendJournalEntry(db, {
    bookingId: input.bookingId,
    financialTransactionId: input.transactionId,
    actorUserId: input.actorUserId,
    kind: "correction",
    reason: input.reason,
    reversesEntryId: allocation.journalEntryId,
    lines: lines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
  });
}

function assertAllocationTotal(
  transactionAmountCents: number,
  allocations: Array<{ amountCents: number; category?: typeof financialCategories.$inferSelect }>,
) {
  if (!allocations.length || allocations.some((allocation) => !Number.isSafeInteger(allocation.amountCents)))
    throw new BookingCommandError("Eine Finanztransaktion braucht mindestens eine gültige Zuordnung.");
  if (allocations.some((allocation) => allocation.amountCents === 0))
    throw new BookingCommandError("Leere Zuordnungen sind nicht zulässig.");
  const allocatedCents = allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  if (allocatedCents !== transactionAmountCents)
    throw new BookingCommandError("Die Zuordnungen müssen exakt dem Kontoumsatz entsprechen.");
}

export type FinancialTransactionPostingInput = {
  transactionId: number;
  categoryId?: number;
  bookingId?: number;
  accountId?: number;
  destinationAccountId?: number;
  note: string;
  actorUserId: string;
  asset?: {
    name: string;
    assetType: "bike" | "equipment" | "other";
    serialNumber?: string | null;
    acquisitionDate: string;
    inServiceDate: string;
    acquisitionCostCents: number;
    inputVatCents?: number;
    usefulLifeMonths: number;
    residualValueCents?: number;
    notes?: string;
  };
  businessMeal?: {
    privateShareCents: number;
    inputVatCents?: number;
  };
};

type FinancialTransactionPostingResult = {
  transactionId: number;
  journalEntryId: number;
  bookingId?: number;
  orderNumber?: string;
};

export function postFinancialTransaction(
  db: AppDatabase,
  input: FinancialTransactionPostingInput,
): FinancialTransactionPostingResult {
  return runInImmediateTransaction(db, () => postFinancialTransactionInTransaction(db, input));
}

export function assignNevloTransactionToBooking(
  db: AppDatabase,
  input: { transactionId: number; bookingId: number; actorUserId: string },
) {
  return runInImmediateTransaction(db, () => {
    const result = assignNevloTransactionToBookingInTransaction(db, input);
    return { transactionId: result.transactionId, bookingId: result.bookingId, orderNumber: result.orderNumber };
  });
}

function assignNevloTransactionToBookingInTransaction(
  db: AppDatabase,
  input: {
    transactionId: number;
    bookingId: number;
    actorUserId: string;
    matchMethod?: "automatic" | "manual";
    allowExistingCategoryAllocation?: boolean;
  },
) {
  const transaction = db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, input.transactionId))
    .get();
  if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
  if (transaction.source !== "bank" || transaction.provider !== "nevlo")
    throw new BookingCommandError("Nur importierte Nevlo-Überweisungen können direkt einem Auftrag zugewiesen werden.");
  if (transaction.status === "ignored")
    throw new BookingCommandError("Eine ignorierte Transaktion kann nicht zugewiesen werden.");
  if (transaction.amountCents <= 0)
    throw new BookingCommandError("Nur Zahlungseingänge können einem Auftrag zugewiesen werden.");
  const existingAllocation = db
    .select()
    .from(financialTransactionAllocations)
    .where(eq(financialTransactionAllocations.transactionId, transaction.id))
    .get();
  const existingCategory = existingAllocation?.categoryId
    ? db.select().from(financialCategories).where(eq(financialCategories.id, existingAllocation.categoryId)).get()
    : undefined;
  const isSameBookingPayment =
    existingAllocation?.bookingId === input.bookingId && existingAllocation.allocationKind === "booking_payment";
  const isPostedBookingPaymentReassignment =
    transaction.status === "posted" &&
    Boolean(existingAllocation?.bookingId) &&
    existingAllocation?.allocationKind === "booking_payment" &&
    existingAllocation.bookingId !== input.bookingId;
  const canConvertExistingCategoryAllocation =
    input.allowExistingCategoryAllocation &&
    transaction.status === "posted" &&
    existingAllocation &&
    !existingAllocation.bookingId &&
    !existingAllocation.fixedAssetId &&
    existingCategory?.code === "rental_revenue";
  if (
    existingAllocation &&
    !canConvertExistingCategoryAllocation &&
    !isSameBookingPayment &&
    !isPostedBookingPaymentReassignment
  )
    throw new BookingCommandError("Diese Transaktion ist bereits zugewiesen.");

  const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
  if (!booking) throw new BookingCommandError("Auftrag nicht gefunden.");
  if (booking.status === "rejected" || booking.status === "cancelled")
    throw new BookingCommandError("Dieser Auftrag ist nicht mehr in einem sinnvollen Zahlungsstatus.");
  const bookingPaymentCategory = getBookingRevenueCategory(db);
  if (isSameBookingPayment) {
    if (!existingAllocation.journalEntryId)
      throw new BookingCommandError("Die bestehende Zahlungszuordnung hat keinen zugehörigen Journalposten.");
    if (existingAllocation.categoryId !== bookingPaymentCategory.id) {
      db.update(financialTransactionAllocations)
        .set({ categoryId: bookingPaymentCategory.id, updatedAt: new Date() })
        .where(eq(financialTransactionAllocations.id, existingAllocation.id))
        .run();
    }
    return {
      journalEntryId: existingAllocation.journalEntryId,
      transactionId: transaction.id,
      bookingId: booking.id,
      orderNumber: booking.orderNumber,
    };
  }
  const receivable = getReceivableStatus(db, booking.id);
  if (hasBookingCharge(db, booking.id)) {
    if (receivable.openCents <= 0)
      throw new BookingCommandError(
        receivable.openCents < 0
          ? "Dieser Auftrag ist bereits überzahlt; bitte prüfe zuerst eine Rückerstattung."
          : "Dieser Auftrag ist bereits vollständig bezahlt.",
      );
    if (transaction.amountCents > receivable.openCents)
      throw new BookingCommandError("Der Zahlungseingang ist höher als der noch offene Auftragsbetrag.");
  } else if (
    booking.quotedTotalCents > 0 &&
    getReceivedPaymentCents(db, booking.id) + transaction.amountCents > booking.quotedTotalCents
  ) {
    throw new BookingCommandError("Die Zahlung darf den bekannten Gesamtpreis der Buchung nicht überschreiten.");
  }

  const sourceAccount = db
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.id, transaction.financialAccountId))
    .get();
  if (!sourceAccount) throw new BookingCommandError("Zugehöriges Bankkonto nicht gefunden.");
  if (isPostedBookingPaymentReassignment && existingAllocation?.bookingId) {
    reverseJournalEntryForCorrection(db, existingAllocation, {
      bookingId: existingAllocation.bookingId,
      transactionId: transaction.id,
      actorUserId: input.actorUserId,
      reason: `Fehlerhafte Auftragszuordnung korrigiert: ${booking.orderNumber}`,
    });
  }
  const journalEntryId = canConvertExistingCategoryAllocation
    ? appendJournalEntry(db, {
        bookingId: booking.id,
        financialTransactionId: transaction.id,
        actorUserId: input.actorUserId,
        kind: "correction",
        reason: `Buchung nachträglich zugeordnet: ${booking.orderNumber}`,
        lines: [
          { account: "rental_revenue", amountCents: transaction.amountCents },
          { account: "accounts_receivable", amountCents: -transaction.amountCents },
        ],
      })
    : appendJournalEntry(db, {
        bookingId: booking.id,
        financialTransactionId: transaction.id,
        actorUserId: input.actorUserId,
        kind: "payment_received",
        reason: `Nevlo-Überweisung ${booking.orderNumber}`,
        lines: [
          { account: sourceAccount.code, amountCents: transaction.amountCents },
          // The charge may be created later. Posting every booking payment to
          // receivables keeps the journal correct regardless of event order.
          { account: "accounts_receivable", amountCents: -transaction.amountCents },
        ],
      });
  const now = new Date();
  if (existingAllocation) {
    // Allocation identity is immutable. Replace the old category allocation
    // with the booking-payment allocation after the correction journal entry.
    db.delete(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.id, existingAllocation.id))
      .run();
  }
  db.insert(financialTransactionAllocations)
    .values({
      transactionId: transaction.id,
      bookingId: booking.id,
      categoryId: bookingPaymentCategory.id,
      allocationKind: "booking_payment",
      matchMethod: input.matchMethod ?? "automatic",
      matchScore: 100,
      amountCents: transaction.amountCents,
      journalEntryId,
      note: `Auftrag ${booking.orderNumber}`,
      matchedByUserId: input.actorUserId,
      matchedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.update(financialTransactions)
    .set({ status: "posted", reconciledAt: now, reconciledByUserId: input.actorUserId, updatedAt: now })
    .where(eq(financialTransactions.id, transaction.id))
    .run();
  return { journalEntryId, transactionId: transaction.id, bookingId: booking.id, orderNumber: booking.orderNumber };
}

export function postFinancialTransactionInTransaction(db: AppDatabase, input: FinancialTransactionPostingInput) {
  const transaction = db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, input.transactionId))
    .get();
  if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
  if (transaction.status === "ignored")
    throw new BookingCommandError("Eine ignorierte Transaktion kann nicht gebucht werden.");
  if (input.bookingId) {
    const category = input.categoryId
      ? db.select().from(financialCategories).where(eq(financialCategories.id, input.categoryId)).get()
      : undefined;
    if (category?.code !== "rental_revenue")
      throw new BookingCommandError("Eine Buchung kann nur der sachlichen Zuordnung „Mieterträge“ zugewiesen werden.");
    return assignNevloTransactionToBookingInTransaction(db, {
      transactionId: input.transactionId,
      bookingId: input.bookingId,
      actorUserId: input.actorUserId,
      matchMethod: "manual",
      allowExistingCategoryAllocation: true,
    });
  }
  const existingAllocations = db
    .select()
    .from(financialTransactionAllocations)
    .where(eq(financialTransactionAllocations.transactionId, transaction.id))
    .all();
  const existingAllocation = existingAllocations[0];
  const existingCategory = existingAllocation?.categoryId
    ? db.select().from(financialCategories).where(eq(financialCategories.id, existingAllocation.categoryId)).get()
    : undefined;
  const isPostedBookingPaymentReclassification =
    transaction.status === "posted" &&
    existingAllocations.length === 1 &&
    existingAllocation?.allocationKind === "booking_payment" &&
    Boolean(existingAllocation.bookingId) &&
    !input.bookingId;
  const isEuerReclassification =
    transaction.status === "posted" &&
    existingAllocations.length === 1 &&
    Boolean(existingAllocation?.categoryId) &&
    Boolean(existingCategory) &&
    !existingAllocation?.bookingId &&
    !existingAllocation?.fixedAssetId;
  if (transaction.status === "posted" && !isEuerReclassification && !isPostedBookingPaymentReclassification)
    throw new BookingCommandError(
      existingAllocations.length > 1
        ? "Eine Transaktion mit mehreren Zuordnungen kann nicht direkt geändert werden. Bitte korrigiere die einzelnen Teilbuchungen separat."
        : "Diese Transaktion kann nicht direkt geändert werden.",
    );
  const isNevloBankTransaction = transaction.source === "bank" && transaction.provider === "nevlo";
  const note = isNevloBankTransaction
    ? transaction.description.trim() || transaction.counterpartyNameSnapshot?.trim() || "Nevlo-Banktransaktion"
    : input.note.trim();
  if (!note) throw new BookingCommandError("Bitte beschreibe den Geschäftsvorfall.");

  if (input.accountId && (transaction.status !== "posted" || !["cash", "manual"].includes(transaction.source))) {
    throw new BookingCommandError(
      "Das Finanzkonto kann nur bei bereits gebuchten manuellen Transaktionen geändert werden.",
    );
  }
  const sourceAccount = db
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.id, input.accountId ?? transaction.financialAccountId))
    .get();
  if (!sourceAccount) throw new BookingCommandError("Zugehöriges Bankkonto nicht gefunden.");
  if (sourceAccount.status !== "active" && transaction.source !== "manual")
    throw new BookingCommandError("Das Finanzkonto ist nicht aktiv.");
  if (sourceAccount.currency !== transaction.currency)
    throw new BookingCommandError("Finanzkonto und Transaktion müssen dieselbe Währung haben.");

  const category = input.categoryId
    ? db.select().from(financialCategories).where(eq(financialCategories.id, input.categoryId)).get()
    : undefined;
  if (!category) throw new BookingCommandError("Bitte wähle eine Kategorie.");
  if (!category.isActive) throw new BookingCommandError("Die gewählte Kategorie ist nicht mehr aktiv.");
  assertCategoryDirection(transaction, category);
  if (input.asset && category.euerTreatment !== "asset_acquisition")
    throw new BookingCommandError("Anlagendaten sind nur bei einer Anlagegutkategorie zulässig.");
  if (input.destinationAccountId && category.categoryType !== "transfer")
    throw new BookingCommandError("Ein Zielkonto darf nur bei internen Umbuchungen angegeben werden.");
  if (isEuerReclassification && category.euerTreatment === "asset_acquisition")
    throw new BookingCommandError("Eine bestehende Buchung kann nicht nachträglich als Anlagegut erfasst werden.");
  if (isEuerReclassification && (input.asset || input.businessMeal))
    throw new BookingCommandError(
      "Eine bestehende EÜR-Zuordnung kann nicht in einen Spezialvorgang umgewandelt werden.",
    );
  if (isPostedBookingPaymentReclassification && category.euerTreatment === "asset_acquisition")
    throw new BookingCommandError(
      "Eine gebuchte Auftragszahlung kann nicht nachträglich als Anlagegut erfasst werden.",
    );
  if (isPostedBookingPaymentReclassification && (input.asset || input.businessMeal))
    throw new BookingCommandError(
      "Eine gebuchte Auftragszahlung kann nicht in einen Spezialvorgang umgewandelt werden.",
    );

  const isBusinessMeal = category.code === "business_meal";
  const grossCents = Math.abs(transaction.amountCents);
  let mealSplit:
    { deductibleCents: number; nonDeductibleCents: number; privateCents: number; inputVatCents: number } | undefined;
  if (isBusinessMeal) {
    const privateCents = input.businessMeal?.privateShareCents ?? 0;
    const inputVatCents = input.businessMeal?.inputVatCents ?? 0;
    if (!Number.isSafeInteger(privateCents) || privateCents < 0 || privateCents > grossCents)
      throw new BookingCommandError("Der Privatanteil muss zwischen 0 € und dem Gesamtbetrag liegen.");
    const businessGrossCents = grossCents - privateCents;
    if (businessGrossCents <= 0)
      throw new BookingCommandError("Mindestens ein Teil des Geschäftsessens muss geschäftlich veranlasst sein.");
    if (!Number.isSafeInteger(inputVatCents) || inputVatCents < 0 || inputVatCents > businessGrossCents)
      throw new BookingCommandError("Die Vorsteuer darf den geschäftlichen Anteil nicht übersteigen.");
    const businessNetCents = businessGrossCents - inputVatCents;
    if (businessNetCents <= 0)
      throw new BookingCommandError("Nach Privatanteil und Vorsteuer muss ein positiver Geschäftsanteil verbleiben.");
    const deductibleCents = Math.round((businessNetCents * 70) / 100);
    mealSplit = {
      deductibleCents,
      nonDeductibleCents: businessNetCents - deductibleCents,
      privateCents,
      inputVatCents,
    };
  } else if (input.businessMeal) {
    throw new BookingCommandError("Der Privatanteil kann nur bei der Kategorie Geschäftsessen erfasst werden.");
  }

  let counterpartAccount = category.accountCode;
  let destinationAccount: typeof financialAccounts.$inferSelect | undefined;
  if (category.categoryType === "transfer") {
    if (!input.destinationAccountId)
      throw new BookingCommandError("Für eine Umbuchung muss ein Zielkonto gewählt werden.");
    destinationAccount = db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.id, input.destinationAccountId))
      .get();
    if (!destinationAccount) throw new BookingCommandError("Zielkonto nicht gefunden.");
    if (destinationAccount.id === sourceAccount.id)
      throw new BookingCommandError("Quell- und Zielkonto dürfen nicht identisch sein.");
    if (destinationAccount.status !== "active") throw new BookingCommandError("Das Zielkonto ist nicht aktiv.");
    if (destinationAccount.currency !== sourceAccount.currency)
      throw new BookingCommandError("Quell- und Zielkonto müssen dieselbe Währung haben.");
    counterpartAccount = destinationAccount.code;
  }

  let fixedAsset: typeof fixedAssets.$inferSelect | undefined;
  if (category.euerTreatment === "asset_acquisition" && !isEuerReclassification) {
    if (!input.asset) throw new BookingCommandError("Bitte erfasse die Daten des Anlageguts.");
    const grossAmountCents = Math.abs(transaction.amountCents);
    const expectedGross = input.asset.acquisitionCostCents + (input.asset.inputVatCents ?? 0);
    if (!Number.isSafeInteger(expectedGross) || expectedGross !== grossAmountCents)
      throw new BookingCommandError(
        "Netto-Anschaffungskosten und Vorsteuer müssen dem Transaktionsbetrag entsprechen.",
      );
    fixedAsset = createFixedAsset(db, {
      ...input.asset,
      sourceTransactionId: transaction.id,
      createdByUserId: input.actorUserId,
    });
    counterpartAccount = fixedAsset.assetAccountCode;
  }

  ensureFinancialAccountInChart(db, sourceAccount);
  if (destinationAccount) ensureFinancialAccountInChart(db, destinationAccount);
  ensureAccountingAccount(db, counterpartAccount);
  if (input.asset) ensureAccountingAccount(db, "tax_input");

  const allocationKind = allocationKindForCategory(category);
  if (isEuerReclassification && existingAllocation && existingCategory) {
    if (!existingAllocation.journalEntryId)
      throw new BookingCommandError("Die bestehende Buchung hat keinen zugehörigen Journalposten.");
    let previousCounterpartAccount = existingCategory.accountCode;
    if (existingCategory.categoryType === "transfer" && existingAllocation.destinationAccountId) {
      const previousDestination = db
        .select()
        .from(financialAccounts)
        .where(eq(financialAccounts.id, existingAllocation.destinationAccountId))
        .get();
      if (previousDestination) previousCounterpartAccount = previousDestination.code;
    }

    const sourceAccountChanged = sourceAccount.id !== transaction.financialAccountId;
    if (sourceAccountChanged) {
      const previousJournalLines = db
        .select({ account: journalLines.account, amountCents: journalLines.amountCents })
        .from(journalLines)
        .where(eq(journalLines.entryId, existingAllocation.journalEntryId))
        .all();
      if (!previousJournalLines.length)
        throw new BookingCommandError("Der bestehende Journalposten konnte nicht korrigiert werden.");
      appendJournalEntry(db, {
        kind: "correction",
        financialTransactionId: transaction.id,
        actorUserId: input.actorUserId,
        reason: `Finanzkonto geändert: ${note}`,
        lines: [
          ...previousJournalLines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
          { account: sourceAccount.code, amountCents: transaction.amountCents },
          { account: counterpartAccount, amountCents: -transaction.amountCents },
        ],
      });
    } else if (previousCounterpartAccount !== counterpartAccount) {
      appendJournalEntry(db, {
        kind: "correction",
        financialTransactionId: transaction.id,
        actorUserId: input.actorUserId,
        reason: `EÜR-Zuordnung korrigiert: ${note}`,
        lines: [
          { account: previousCounterpartAccount, amountCents: transaction.amountCents },
          { account: counterpartAccount, amountCents: -transaction.amountCents },
        ],
      });
    }

    db.update(financialTransactionAllocations)
      .set({
        categoryId: category.id,
        destinationAccountId: destinationAccount?.id ?? null,
        allocationKind,
        matchMethod: "manual",
        note,
        matchedByUserId: input.actorUserId,
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(financialTransactionAllocations.id, existingAllocation.id))
      .run();
    db.update(financialTransactions)
      .set({ financialAccountId: sourceAccount.id, notes: note, updatedAt: new Date() })
      .where(eq(financialTransactions.id, transaction.id))
      .run();

    return { journalEntryId: existingAllocation.journalEntryId, transactionId: transaction.id };
  }

  let allocationParts: AllocationPart[];
  if (mealSplit) {
    allocationParts = [
      { category, amountCents: -mealSplit.deductibleCents, allocationKind: "expense" },
      ...(mealSplit.nonDeductibleCents > 0
        ? [
            {
              category: getActiveFinancialCategoryByCode(db, "business_meal_non_deductible"),
              amountCents: -mealSplit.nonDeductibleCents,
              allocationKind: "other" as const,
            },
          ]
        : []),
      ...(mealSplit.privateCents > 0
        ? [
            {
              category: getActiveFinancialCategoryByCode(db, "private_meal_share"),
              amountCents: -mealSplit.privateCents,
              allocationKind: "other" as const,
            },
          ]
        : []),
      ...(mealSplit.inputVatCents > 0
        ? [
            {
              category: getActiveFinancialCategoryByCode(db, "input_vat"),
              amountCents: -mealSplit.inputVatCents,
              allocationKind: "tax" as const,
            },
          ]
        : []),
    ];
  } else if (fixedAsset && input.asset) {
    allocationParts = [
      { category, amountCents: -input.asset.acquisitionCostCents, allocationKind: "asset_acquisition" },
      ...(input.asset.inputVatCents
        ? [
            {
              category: getActiveFinancialCategoryByCode(db, "input_vat"),
              amountCents: -input.asset.inputVatCents,
              allocationKind: "tax" as const,
            },
          ]
        : []),
    ];
  } else {
    allocationParts = [{ category, amountCents: transaction.amountCents, allocationKind }];
  }
  assertAllocationTotal(transaction.amountCents, allocationParts);
  for (const part of allocationParts) ensureAccountingAccount(db, part.category.accountCode);

  const journalEntryId = appendJournalEntry(db, {
    kind: journalKindForTransaction(transaction, category),
    financialTransactionId: transaction.id,
    actorUserId: input.actorUserId,
    reason: note,
    lines: fixedAsset
      ? [
          { account: sourceAccount.code, amountCents: transaction.amountCents },
          { account: fixedAsset.assetAccountCode, amountCents: input.asset?.acquisitionCostCents ?? 0 },
          ...(input.asset?.inputVatCents ? [{ account: "tax_input", amountCents: input.asset.inputVatCents }] : []),
        ]
      : [
          { account: sourceAccount.code, amountCents: transaction.amountCents },
          ...allocationParts.map((part) => ({ account: part.category.accountCode, amountCents: -part.amountCents })),
        ],
  });

  const now = new Date();
  if (isPostedBookingPaymentReclassification && existingAllocation?.bookingId && existingAllocation.journalEntryId) {
    reverseJournalEntryForCorrection(db, existingAllocation, {
      bookingId: existingAllocation.bookingId,
      transactionId: transaction.id,
      actorUserId: input.actorUserId,
      reason: `Fehlerhafte Auftragszuordnung korrigiert: ${note}`,
    });
  }
  if (isPostedBookingPaymentReclassification && existingAllocation) {
    db.delete(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.id, existingAllocation.id))
      .run();
  }
  db.insert(financialTransactionAllocations)
    .values(
      allocationParts.map((part) => ({
        transactionId: transaction.id,
        categoryId: part.category.id,
        fixedAssetId: fixedAsset && part.category.euerTreatment === "asset_acquisition" ? fixedAsset.id : null,
        destinationAccountId: destinationAccount?.id ?? null,
        allocationKind: part.allocationKind,
        matchMethod: "manual" as const,
        amountCents: part.amountCents,
        journalEntryId,
        note,
        matchedByUserId: input.actorUserId,
        matchedAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();

  const reconciledAt = new Date();
  db.update(financialTransactions)
    .set({
      status: "posted",
      notes: note,
      reconciledAt,
      reconciledByUserId: input.actorUserId,
      updatedAt: reconciledAt,
    })
    .where(eq(financialTransactions.id, transaction.id))
    .run();

  return { journalEntryId, transactionId: transaction.id };
}

export function ignoreFinancialTransaction(
  db: AppDatabase,
  input: { transactionId: number; reason: string; actorUserId: string },
) {
  if (!input.reason.trim()) throw new BookingCommandError("Bitte begründe, warum die Transaktion ignoriert wird.");
  return runInImmediateTransaction(db, () => {
    const transaction = db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, input.transactionId))
      .get();
    if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
    if (transaction.status === "posted")
      throw new BookingCommandError("Eine gebuchte Transaktion kann nicht ignoriert werden.");
    const now = new Date();
    const notes = [transaction.notes, `Ignoriert: ${input.reason.trim()}`].filter(Boolean).join("\n");
    db.update(financialTransactions)
      .set({
        status: "ignored",
        notes,
        reconciledAt: now,
        reconciledByUserId: input.actorUserId,
        updatedAt: now,
      })
      .where(eq(financialTransactions.id, input.transactionId))
      .run();
    return { transactionId: input.transactionId };
  });
}

export function getFinancialAccountReconciliation(db: AppDatabase, accountId: number) {
  const account = db.select().from(financialAccounts).where(eq(financialAccounts.id, accountId)).get();
  if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");
  const movements = db
    .select({ amountCents: financialTransactions.amountCents })
    .from(financialTransactions)
    .where(eq(financialTransactions.financialAccountId, accountId))
    .all();
  const mirroredTransfers = db
    .select({ amountCents: financialTransactionAllocations.amountCents })
    .from(financialTransactionAllocations)
    .where(
      and(
        eq(financialTransactionAllocations.destinationAccountId, accountId),
        eq(financialTransactionAllocations.allocationKind, "transfer"),
      ),
    )
    .all();
  const expectedBalanceCents =
    account.openingBalanceCents +
    movements.reduce((sum, row) => sum + row.amountCents, 0) -
    mirroredTransfers.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    account,
    expectedBalanceCents,
    providerBalanceCents: account.providerBalanceCents,
    differenceCents: account.providerBalanceCents === null ? null : expectedBalanceCents - account.providerBalanceCents,
  };
}
