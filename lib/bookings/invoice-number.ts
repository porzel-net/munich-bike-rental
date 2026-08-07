import { like } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { bookings } from "../db/schema";

/** Allocates the next invoice number for a completion year. Call inside an immediate transaction. */
export function allocateInvoiceNumber(db: AppDatabase, issuedAt = new Date()) {
  const year = issuedAt.getFullYear();
  const prefix = `YBR-${year}-`;
  const existing = db
    .select({ invoiceNumber: bookings.invoiceNumber })
    .from(bookings)
    .where(like(bookings.invoiceNumber, `${prefix}%`))
    .all();
  const next =
    existing.reduce((highest, row) => {
      const suffix = row.invoiceNumber?.slice(prefix.length) ?? "";
      const value = /^\d{4}$/.test(suffix) ? Number(suffix) : 0;
      return Math.max(highest, value);
    }, 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
