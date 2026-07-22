"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { AccountingRevenueDialog, type AccountingRevenuePatch } from "@/components/accounting-revenue-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AccountingRevenue = {
  id: number;
  inquiryId: number;
  orderNumber: string;
  amountCents: number;
  paidAmountCents: number;
  paymentReceivedAt: string | null;
  payerName: string;
  notes: string;
  createdAt: Date;
  payments: AccountingRevenuePayment[];
};

export type AccountingRevenuePayment = {
  id: number;
  revenueId: number;
  amountCents: number;
  receivedAt: string;
};

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatDate(date: string | null) {
  return date ? dateFormatter.format(new Date(`${date}T00:00:00`)) : "—";
}

function paymentSummary(revenue: AccountingRevenue) {
  if (revenue.payments.length === 0) return "—";
  if (revenue.payments.length === 1) return formatDate(revenue.payments[0].receivedAt);
  return `${revenue.payments.length} Teilüberweisungen`;
}

function PaymentStatusBadge({ revenue }: { revenue: AccountingRevenue }) {
  const isPaid = revenue.amountCents === 0 || revenue.paidAmountCents >= revenue.amountCents;
  return (
    <Badge
      variant="outline"
      className={
        isPaid
          ? "border-[#639754] bg-[#639754]/15 text-[#426537]"
          : "border-[#D61F1F] bg-[#D61F1F]/10 text-[#D61F1F]"
      }
    >
      {isPaid ? "Bezahlt" : "Unbezahlt"}
    </Badge>
  );
}

export function AccountingRevenuesTable({ revenues }: { revenues: AccountingRevenue[] }) {
  const [revenueRows, setRevenueRows] = useState(revenues);
  const [selectedRevenue, setSelectedRevenue] = useState<AccountingRevenue | null>(null);
  const [search, setSearch] = useState("");
  const filteredRevenues = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    if (!query) return revenueRows;
    return revenueRows.filter((revenue) => {
      const isPaid = revenue.amountCents === 0 || revenue.paidAmountCents >= revenue.amountCents;
      return [
        revenue.orderNumber,
        revenue.paymentReceivedAt ?? "",
        revenue.payerName,
        revenue.notes,
        isPaid ? "bezahlt" : "unbezahlt",
        (revenue.amountCents / 100).toFixed(2),
        revenue.amountCents.toString(),
        (revenue.paidAmountCents / 100).toFixed(2),
        revenue.paidAmountCents.toString(),
        ...revenue.payments.flatMap((payment) => [payment.receivedAt, (payment.amountCents / 100).toFixed(2)]),
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(query);
    });
  }, [revenueRows, search]);
  const totalAmountCents = filteredRevenues.reduce((total, revenue) => total + revenue.amountCents, 0);
  const totalPaidAmountCents = filteredRevenues.reduce((total, revenue) => total + revenue.paidAmountCents, 0);

  function updateRevenue(patch: AccountingRevenuePatch) {
    setRevenueRows((current) =>
      current.map((revenue) => (revenue.id === patch.id ? { ...revenue, ...patch } : revenue)),
    );
    setSelectedRevenue(null);
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
          <CardTitle>Erträge</CardTitle>
          <CardDescription>Erträge aus Aufträgen und deren Zahlungseingänge.</CardDescription>
          </div>
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Erträge durchsuchen..."
              aria-label="Erträge durchsuchen"
            />
          </InputGroup>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftragsnummer</TableHead>
              <TableHead>Zahlungseingang</TableHead>
              <TableHead>Zahlungspflichtiger</TableHead>
              <TableHead>Notizen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead className="text-right">Bereits bezahlt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRevenues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Noch keine Erträge vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              filteredRevenues.map((revenue) => (
                <TableRow
                  key={revenue.id}
                  role="button"
                  tabIndex={0}
                  title="Zahlung bearbeiten"
                  className="cursor-pointer"
                  onClick={() => setSelectedRevenue(revenue)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedRevenue(revenue);
                    }
                  }}
                >
                  <TableCell>{revenue.orderNumber}</TableCell>
                  <TableCell>{paymentSummary(revenue)}</TableCell>
                  <TableCell>{revenue.payerName}</TableCell>
                  <TableCell className="max-w-xs truncate">{revenue.notes || "—"}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge revenue={revenue} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {euroFormatter.format(revenue.amountCents / 100)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euroFormatter.format(revenue.paidAmountCents / 100)}
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow>
              <TableCell colSpan={6}>Gesamtbetrag</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {euroFormatter.format(totalAmountCents / 100)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={6}>Ausstehende Beträge</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {euroFormatter.format((totalAmountCents - totalPaidAmountCents) / 100)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
      {selectedRevenue ? (
        <AccountingRevenueDialog
          key={selectedRevenue.id}
          revenue={selectedRevenue}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedRevenue(null);
          }}
          onSaved={updateRevenue}
        />
      ) : null}
    </Card>
  );
}
