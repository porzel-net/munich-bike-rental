"use client";

import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import type { FinancialReviewCategory } from "@/components/financial-review-inbox";
import type { EuerRow, EuerSummary } from "@/lib/financial/euer";

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

function formatDate(value: string) {
  const dateOnly = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateOnly) return value;
  const [year, month, day] = dateOnly.split("-");
  return `${day}.${month}.${year}`;
}

function treatmentLabel(treatment: string) {
  if (treatment === "income") return "Einnahme";
  if (treatment === "expense") return "Ausgabe";
  if (treatment === "tax_payment") return "USt-Zahlung";
  if (treatment === "transfer") return "Interne Umbuchung";
  if (treatment === "needs_review") return "Prüfung offen";
  if (treatment === "asset_acquisition") return "Anlagegut";
  return "Nicht EÜR-relevant";
}

function rowTarget(row: EuerRow) {
  if (row.source === "bank") return `/admin/accounting/transactions?transaction=${row.transactionId}`;
  if (row.source === "stripe" && row.bookingId) return `/admin/bookings/${row.bookingId}`;
  return null;
}

function displayDescription(row: EuerRow) {
  const description = row.description || "Ohne Beschreibung";
  if (row.source === "depreciation") return `${description} · AfA`;
  if (row.source !== "stripe") return description;
  return description.replace(/\s+cs_(?:test|live)_[A-Za-z0-9]+$/i, "").trim() || "Stripe-Zahlung";
}

export function EuerSummary({
  data,
  categories,
  accounts,
}: {
  data: EuerSummary;
  categories: FinancialReviewCategory[];
  accounts: { id: number; name: string; type: string }[];
}) {
  const router = useRouter();
  const euerRows = data.rows.filter((row) =>
    ["income", "expense", "tax_payment", "input_vat", "output_vat", "needs_review"].includes(row.euerTreatment),
  );
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">EÜR {data.year}</h2>
          <p className="text-sm text-muted-foreground">
            Einnahmen und Ausgaben nach steuerlicher Kategorie. Interne Umbuchungen bleiben ausgeschlossen.
          </p>
        </div>
        <ManualFinancialTransactionLauncher categories={categories} accounts={accounts} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="min-h-36 rounded-2xl border border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex min-h-36 flex-col gap-1 p-4">
            <CardDescription className="min-h-8 text-xs font-medium uppercase tracking-[0.08em]">
              Einnahmen
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums text-emerald-600 sm:text-3xl">
              {formatAmount(data.incomeCents)}
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">Im laufenden Jahr</CardDescription>
          </CardContent>
        </Card>
        <Card className="min-h-36 rounded-2xl border border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex min-h-36 flex-col gap-1 p-4">
            <CardDescription className="min-h-8 text-xs font-medium uppercase tracking-[0.08em]">
              Ausgaben
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums text-destructive sm:text-3xl">
              {formatAmount(data.expenseCents)}
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">Im laufenden Jahr</CardDescription>
          </CardContent>
        </Card>
        <Card className="min-h-36 rounded-2xl border border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex min-h-36 flex-col gap-1 p-4">
            <CardDescription className="min-h-8 text-xs font-medium uppercase tracking-[0.08em]">
              Gewinn vor Steuerkorrekturen
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {formatAmount(data.profitCents)}
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">Einnahmen minus Ausgaben</CardDescription>
          </CardContent>
        </Card>
        <Card className="min-h-36 rounded-2xl border border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex min-h-36 flex-col gap-1 p-4">
            <CardDescription className="min-h-8 text-xs font-medium uppercase tracking-[0.08em]">
              USt-Zahlungen
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {formatAmount(data.vatPaymentCents)}
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">Erfasste Zahlungen</CardDescription>
          </CardContent>
        </Card>
        <Card className="min-h-36 rounded-2xl border border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex min-h-36 flex-col gap-1 p-4">
            <CardDescription className="min-h-8 text-xs font-medium uppercase tracking-[0.08em]">
              Interne Umbuchungen
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums text-muted-foreground sm:text-3xl">
              {formatAmount(data.excludedInternalCents)}
            </CardTitle>
            <CardDescription className="text-xs tabular-nums">Nicht EÜR-relevant</CardDescription>
          </CardContent>
        </Card>
      </div>
      <div className="overflow-hidden rounded-3xl bg-card">
        <Table className="text-sm">
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>Datum</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Quelle / Beschreibung</TableHead>
              <TableHead>Rechnungsnummer</TableHead>
              <TableHead>Wirkung</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {euerRows.length ? (
              euerRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={[
                    row.euerTreatment === "transfer" ? "text-muted-foreground" : "",
                    rowTarget(row) ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  tabIndex={rowTarget(row) ? 0 : undefined}
                  onClick={() => {
                    const target = rowTarget(row);
                    if (target) router.push(target);
                  }}
                  onKeyDown={(event) => {
                    const target = rowTarget(row);
                    if (!target || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    router.push(target);
                  }}
                >
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell className="font-medium">{row.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{displayDescription(row)}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.source === "depreciation"
                          ? "Anlageverzeichnis"
                          : `${row.source} · Transaktion #${row.transactionId}${row.accountName ? ` · ${row.accountName}${row.iban ? ` · ${row.iban}` : ""}` : ""}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{row.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>{treatmentLabel(row.euerTreatment)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatAmount(Math.abs(row.amountCents))}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Noch keine gebuchten EÜR-Positionen.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
