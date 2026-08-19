import type { FinancialTransactionKind, FinancialTransactionSource } from "@/lib/db/schema/accounting";

const transactionKindLabels: Record<FinancialTransactionKind, string> = {
  payment: "Zahlung",
  refund: "Erstattung",
  fee: "Gebühr",
  payout: "Auszahlung",
  transfer: "Überweisung",
  cash_withdrawal: "Bargeldabhebung",
  cash_expense: "Barausgabe",
  bank_fee: "Bankgebühr",
  tax_payment: "Steuerzahlung",
  income: "Einnahme",
  expense: "Ausgabe",
  other: "Sonstiger Vorgang",
};

const transactionSourceLabels: Record<FinancialTransactionSource, string> = {
  bank: "Bank",
  stripe: "Stripe",
  cash: "Bar",
  manual: "Manuell",
  other: "Sonstige Quelle",
};

const journalEntryKindLabels: Record<string, string> = {
  rental_charge: "Mietumsatz",
  cancellation_fee: "Stornogebühr",
  payment_received: "Zahlungseingang",
  refund_issued: "Erstattung",
  credit_note: "Gutschrift",
  expense: "Aufwand",
  depreciation: "Abschreibung (AfA)",
  capital_contribution: "Privateinlage",
  correction: "Korrektur",
  legacy_import: "Historischer Import",
};

export function formatFinancialTransactionKind(kind: string) {
  return transactionKindLabels[kind as FinancialTransactionKind] ?? "Sonstiger Vorgang";
}

export function formatFinancialTransactionSource(source: string) {
  return transactionSourceLabels[source as FinancialTransactionSource] ?? "Sonstige Quelle";
}

export function formatJournalEntryKind(kind: string) {
  return journalEntryKindLabels[kind] ?? "Buchung";
}
