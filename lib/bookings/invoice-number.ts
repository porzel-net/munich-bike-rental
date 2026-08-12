import { like } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { bookings } from "../db/schema";

export const invoiceNumberPattern = /^YBR-\d{4}-\d{4}$/;

/** Allocates the next invoice number for a completion year. Call inside an immediate transaction. */
export function allocateInvoiceNumber(db: AppDatabase, issuedAt = new Date()) {
  const year = issuedAt.getFullYear();
  const prefix = `YBR-${year}-`;
  const existing = db
    .select({ invoiceNumber: bookings.invoiceNumber })
    .from(bookings)
    .where(like(bookings.invoiceNumber, `${prefix}%`))
    .all();
  const numbers = existing.map((row) => {
    const value = row.invoiceNumber?.slice(prefix.length) ?? "";
    if (!/^\d{4}$/.test(value)) throw new Error("Die vorhandenen Rechnungsnummern haben ein ungültiges Format.");
    const number = Number(value);
    if (number < 1) throw new Error("Rechnungsnummern müssen mit 0001 beginnen.");
    return number;
  });
  const uniqueNumbers = new Set(numbers);
  for (let expected = 1; expected <= uniqueNumbers.size; expected += 1) {
    if (!uniqueNumbers.has(expected))
      throw new Error("Die Rechnungsnummern sind nicht lückenlos und müssen zuerst korrigiert werden.");
  }
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  if (next > 9_999) throw new Error("Für dieses Jahr sind keine weiteren Rechnungsnummern verfügbar.");
  return `${prefix}${String(next).padStart(4, "0")}`;
}
