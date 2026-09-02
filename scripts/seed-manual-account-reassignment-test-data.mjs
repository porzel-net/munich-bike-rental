import Database from "better-sqlite3";
import { isAbsolute, resolve } from "node:path";

const configuredDatabasePath = process.env.DATABASE_URL?.trim() || "data/bikerental.db";
if (configuredDatabasePath === ":memory:") {
  throw new Error("Der Finanz-Testdatensatz benötigt eine persistente Datenbank.");
}

const databasePath = isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : resolve(process.cwd(), configuredDatabasePath);
const externalId = "codex-test-manual-account-reassignment-20260902";
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = ON");
  const existing = db
    .prepare("SELECT id FROM financial_transactions WHERE source = ? AND provider = ? AND external_id = ?")
    .get("manual", "manual", externalId);
  if (existing) {
    console.log(`Testdatensatz existiert bereits: Transaktion #${existing.id}`);
  } else {
    const operatingAccount = db
      .prepare("SELECT id, code, name, currency FROM financial_accounts WHERE code = ?")
      .get("operating_main");
    const privateAccount = db
      .prepare("SELECT id, code, name, currency FROM financial_accounts WHERE code = ?")
      .get("private_main");
    const category = db.prepare("SELECT id FROM financial_categories WHERE code = ? AND is_active = 1").get("wages");
    if (!operatingAccount) throw new Error("Das Finanzkonto operating_main wurde nicht gefunden.");
    if (!privateAccount) throw new Error("Das Finanzkonto private_main wurde nicht gefunden.");
    if (!category) throw new Error("Die aktive Kategorie wages wurde nicht gefunden.");
    if (operatingAccount.currency !== privateAccount.currency)
      throw new Error("Betriebskonto und Privatkonto haben unterschiedliche Währungen.");

    const amountCents = -12_345;
    const bookedAt = "2026-09-02";
    const now = Date.now();
    const note = "TESTDATENSATZ: Manuelle Buchung – Konto nachträglich auf Privat ändern";

    const insert = db.transaction(() => {
      db.prepare(
        `INSERT OR IGNORE INTO accounting_accounts
          (code, name, account_type, is_system, is_active, notes, created_at, updated_at)
         VALUES (?, ?, 'asset', 1, 1, ?, ?, ?)`,
      ).run(privateAccount.code, privateAccount.name, `Finanzkonto ${privateAccount.code}`, now, now);

      const transaction = db
        .prepare(
          `INSERT INTO financial_transactions
            (financial_account_id, source, provider, external_id, kind, status, amount_cents, currency, booked_at,
             counterparty_name_snapshot, reference, description, notes, reconciled_at, imported_at, created_at, updated_at)
           VALUES (?, 'manual', 'manual', ?, 'expense', 'posted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          operatingAccount.id,
          externalId,
          amountCents,
          operatingAccount.currency,
          bookedAt,
          "TEST – Kontoänderung Privat",
          "TEST-MANUAL-ACCOUNT-REASSIGNMENT",
          "Manuelle Testausgabe: Betriebskonto → Privat",
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
        operatingAccount.code,
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
    console.log(`Vorheriges Finanzkonto: ${operatingAccount.name}`);
    console.log(`Testziel: ${privateAccount.name}`);
  }
} finally {
  db.close();
}
