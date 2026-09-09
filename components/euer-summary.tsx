"use client";

import { useRouter } from "next/navigation";

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EuerRow, EuerSummary } from "@/lib/financial/euer";
import { formatDateOnly } from "@/lib/datetime";

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + " %";
}

function formatDate(value: string) {
  const dateOnly = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateOnly) return value;
  return formatDateOnly(dateOnly);
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

function displayRowAmount(row: EuerRow) {
  return row.euerTreatment === "income" ? row.amountCents : Math.abs(row.amountCents);
}

function rowTarget(row: EuerRow) {
  if (row.transactionId) return `/admin/accounting/transactions?transaction=${row.transactionId}`;
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

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card size="sm" className="@container/card h-full rounded-2xl shadow-xs">
      <CardHeader className="gap-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums @[240px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="mt-auto items-start pt-0 text-sm text-muted-foreground">
        <span>{detail}</span>
      </CardFooter>
    </Card>
  );
}

export function EuerSummary({ data }: { data: EuerSummary }) {
  const router = useRouter();
  const euerRows = data.rows.filter((row) =>
    ["income", "expense", "tax_payment", "input_vat", "output_vat", "needs_review"].includes(row.euerTreatment),
  );
  const profitMargin = data.incomeCents > 0 ? (data.profitCents / data.incomeCents) * 100 : 0;
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <SummaryMetric label="Einnahmen" value={formatAmount(data.incomeCents)} detail="Laufendes Jahr" />
        <SummaryMetric label="Ausgaben" value={formatAmount(data.expenseCents)} detail="Laufendes Jahr" />
        <SummaryMetric label="Ausstehend" value={formatAmount(data.outstandingCents)} detail="Zu überweisen" />
        <SummaryMetric
          label="Noch abzuschreiben"
          value={formatAmount(data.remainingDepreciationCents)}
          detail="Aktive Anlagegüter"
        />
        <SummaryMetric
          label="Schon abgeschrieben"
          value={formatAmount(data.postedDepreciationCents)}
          detail="Aktive Anlagegüter"
        />
        <SummaryMetric label="Gewinn vor Steuer" value={formatAmount(data.profitCents)} detail="Einn. − Ausg." />
        <SummaryMetric label="EBITDA" value={formatAmount(data.ebitdaCents)} detail="Gewinn + USt + AfA" />
        <SummaryMetric label="Gewinnmarge" value={formatPercentage(profitMargin)} detail="Gewinn / Einnahmen" />
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
                    {formatAmount(displayRowAmount(row))}
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
