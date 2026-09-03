import Database from "better-sqlite3";
import { isAbsolute, resolve } from "node:path";

const configuredDatabasePath = process.env.DATABASE_URL?.trim() || "data/bikerental.db";
if (configuredDatabasePath === ":memory:") {
  throw new Error("Der Finanz-Testdatensatz benötigt eine persistente Datenbank.");
}

const databasePath = isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : resolve(process.cwd(), configuredDatabasePath);
const externalId = "codex-test-receipt-required-20260902";
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = ON");
  const existing = db
    .prepare("SELECT id FROM financial_transactions WHERE source = ? AND provider = ? AND external_id = ?")
    .get("bank", "nevlo", externalId);
  if (existing) {
    console.log(`Testdatensatz existiert bereits: Transaktion #${existing.id}`);
    process.exitCode = 0;
  } else {
    const account = db.prepare("SELECT id, code FROM financial_accounts WHERE code = ?").get("operating_main");
    const category = db
      .prepare("SELECT id FROM financial_categories WHERE code = ? AND is_active = 1")
      .get("spare_parts_consumables");
    if (!account) throw new Error("Das Finanzkonto operating_main wurde nicht gefunden.");
    if (!category) throw new Error("Die aktive Kategorie spare_parts_consumables wurde nicht gefunden.");

    const amountCents = -19_977;
    const bookedAt = "2026-09-02";
    const now = Date.now();
    const note = "TESTDATENSATZ: Gebucht und abgestimmt, Pflichtbeleg fehlt";

    const insert = db.transaction(() => {
      const transaction = db
        .prepare(
          `INSERT INTO financial_transactions
            (financial_account_id, source, provider, external_id, kind, status, amount_cents, currency, booked_at,
             counterparty_name_snapshot, reference, description, notes, reconciled_at, imported_at, created_at, updated_at)
           VALUES (?, 'bank', 'nevlo', ?, 'expense', 'posted', ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          account.id,
          externalId,
          amountCents,
          bookedAt,
          "TEST – Ersatzteile und Verbrauchsmaterial",
          "TEST-RECEIPT-REQUIRED",
          "Testausgabe ohne hinterlegten Beleg",
          note,
          now,
          now,
          now,
          now,
        );
      const transactionId = Number(transaction.lastInsertRowid);

      const journalEntry = db
        .prepare(
          `INSERT INTO journal_entries
            (financial_transaction_id, kind, reason, occurred_at, created_at)
           VALUES (?, 'expense', ?, ?, ?)`,
        )
        .run(transactionId, note, now, now);
      const journalEntryId = Number(journalEntry.lastInsertRowid);

      db.prepare("INSERT INTO journal_lines (entry_id, account, amount_cents) VALUES (?, ?, ?)").run(
        journalEntryId,
        account.code,
        amountCents,
      );
      db.prepare("INSERT INTO journal_lines (entry_id, account, amount_cents) VALUES (?, 'expense', ?)").run(
        journalEntryId,
        -amountCents,
      );

      db.prepare(
        `INSERT INTO financial_transaction_allocations
          (transaction_id, category_id, journal_entry_id, allocation_kind, match_method, amount_cents, note,
           matched_at, created_at, updated_at)
         VALUES (?, ?, ?, 'expense', 'manual', ?, ?, ?, ?, ?)`,
      ).run(transactionId, category.id, journalEntryId, amountCents, note, now, now, now);

      return transactionId;
    });

    const transactionId = insert();
    console.log(`Testdatensatz angelegt: Transaktion #${transactionId}`);
    console.log("Erwarteter Tabellenstatus: Beleg fehlt");
  }
} finally {
  db.close();
}
