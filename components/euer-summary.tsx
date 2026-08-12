"use client";

import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import type {
  FinancialReviewAccount,
  FinancialReviewBooking,
  FinancialReviewCategory,
} from "@/components/financial-review-inbox";
import type { EuerRow, EuerSummary } from "@/lib/financial/euer";

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + " %";
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

function displaySource(row: EuerRow) {
  if (row.source === "depreciation") return "AfA · Anlageverzeichnis";
  if (row.source === "asset_sale") return "Verkauf · Anlageverzeichnis";
  if (row.source === "asset_disposal") return "Restbuchwert · Anlageverzeichnis";
  if (row.source === "stripe") return "Stripe · Stripe-Verrechnungskonto";
  return `Bank · ${row.accountName || "Unbekanntes Konto"}`;
}

export function EuerSummary({
  data,
  categories,
  accounts,
  bookings,
}: {
  data: EuerSummary;
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  bookings: FinancialReviewBooking[];
}) {
  const router = useRouter();
  const euerRows = data.rows.filter((row) =>
    ["income", "expense", "tax_payment", "input_vat", "output_vat", "needs_review"].includes(row.euerTreatment),
  );
  const profitMargin = data.incomeCents > 0 ? (data.profitCents / data.incomeCents) * 100 : 0;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">EÜR {data.year}</h2>
          <p className="text-sm text-muted-foreground">
            Einnahmen und Ausgaben nach steuerlicher Kategorie. Interne Umbuchungen bleiben ausgeschlossen.
          </p>
        </div>
        <ManualFinancialTransactionLauncher categories={categories} accounts={accounts} bookings={bookings} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Einnahmen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatAmount(data.incomeCents)}</CardTitle>
            <CardDescription className="tabular-nums">Laufendes Jahr</CardDescription>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Ausgaben</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatAmount(data.expenseCents)}</CardTitle>
            <CardDescription className="tabular-nums">Laufendes Jahr</CardDescription>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Gewinn vor Steuer</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatAmount(data.profitCents)}</CardTitle>
            <CardDescription className="tabular-nums">Einnahmen − Ausgaben</CardDescription>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Umbuchungen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatAmount(data.excludedInternalCents)}</CardTitle>
            <CardDescription className="tabular-nums">Nicht EÜR-relevant</CardDescription>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Gewinnmarge</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatPercentage(profitMargin)}</CardTitle>
            <CardDescription className="tabular-nums">Gewinn / Einnahmen</CardDescription>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-1">
            <CardDescription>Prüfung offen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatAmount(data.unresolvedCents)}</CardTitle>
            <CardDescription className="tabular-nums">EÜR-Zuordnung offen</CardDescription>
          </CardContent>
        </Card>
      </div>
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <Table className="text-sm [&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
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
                      <span className="text-xs text-muted-foreground">{displaySource(row)}</span>
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
      </Card>
    </section>
  );
}
