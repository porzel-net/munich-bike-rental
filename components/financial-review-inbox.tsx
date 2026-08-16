"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NevloSyncButton } from "@/components/nevlo-sync-button";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { Button } from "@/components/ui/button";

export type FinancialReviewCategory = {
  id: number;
  code: string;
  name: string;
  categoryType: string;
  euerTreatment: string;
  euerLine: string;
};

export type FinancialReviewAccount = {
  id: number;
  code: string;
  name: string;
  currency: string;
  status?: string;
};

export type FinancialReviewBooking = {
  id: number;
  orderNumber: string;
  customerName: string;
  status: string;
};

export type FinancialReviewTransaction = {
  id: number;
  financialAccountId: number;
  accountName: string;
  accountCode: string;
  source: string;
  kind: string;
  status: string;
  euerTreatment: string | null;
  categoryId: number | null;
  destinationAccountId: number | null;
  amountCents: number;
  currency: string;
  bookedAt: string;
  valueDate: string | null;
  counterpartyName: string | null;
  reference: string;
  description: string;
  notes: string;
  documentCount: number;
  documents: Array<{ id: number; originalFileName: string }>;
  matchedBooking: { id: number; orderNumber: string } | null;
};

function formatBookedDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Datum unbekannt";
  const dateOnly = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = new Date(normalized);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Datum unbekannt";
}

function formatAmount(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

function statusLabel(status: string, euerTreatment: string | null) {
  if (status === "posted" && euerTreatment === "needs_review") return "Gebucht · EÜR offen";
  if (status === "posted") return "Gebucht & abgestimmt";
  if (status === "ignored") return "Ignoriert";
  return "Prüfung offen";
}

export function FinancialReviewInbox({
  transactions,
  categories,
  accounts,
  bookings,
  initialTransactionId,
  title = "Buchhaltung",
}: {
  transactions: FinancialReviewTransaction[];
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  bookings: FinancialReviewBooking[];
  initialTransactionId?: number;
  title?: string;
}) {
  const [rows, setRows] = useState(transactions);
  const [selected, setSelected] = useState<FinancialReviewTransaction | null>(null);
  const initialReviewOpened = useRef(false);
  const openCount = rows.filter((row) => row.status !== "posted" && row.status !== "ignored").length;
  const [assigningId, setAssigningId] = useState<number | null>(null);

  async function assignBooking(row: FinancialReviewTransaction) {
    if (!row.matchedBooking) return;
    setAssigningId(row.id);
    try {
      const response = await fetch(`/api/admin/financial/transactions/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_booking", bookingId: row.matchedBooking.id }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Auftrag konnte nicht zugewiesen werden.");
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: "posted" } : item)));
      toast.success(`Auftrag ${row.matchedBooking.orderNumber} wurde zugewiesen.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Auftrag konnte nicht zugewiesen werden.");
    } finally {
      setAssigningId(null);
    }
  }

  const openReview = useCallback((row: FinancialReviewTransaction) => {
    setSelected(row);
  }, []);

  useEffect(() => {
    if (!initialTransactionId || initialReviewOpened.current) return;
    const initialRow = rows.find((row) => row.id === initialTransactionId);
    if (!initialRow) return;
    initialReviewOpened.current = true;
    const timer = window.setTimeout(() => openReview(initialRow), 0);
    return () => window.clearTimeout(timer);
  }, [initialTransactionId, openReview, rows]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ManualFinancialTransactionLauncher categories={categories} accounts={accounts} bookings={bookings} />
          <NevloSyncButton />
          <Badge variant={openCount ? "destructive" : "outline"}>{openCount} offen</Badge>
        </div>
      </div>
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <Table className="text-sm [&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead>Datum / Konto</TableHead>
              <TableHead>Gegenpartei / Verwendungszweck</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Noch keine Finanztransaktionen erfasst.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
                  tabIndex={0}
                  onClick={() => openReview(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openReview(row);
                    }
                  }}
                >
                  <TableCell>
                    <div
                      className={`flex size-8 items-center justify-center rounded-md ${row.amountCents >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                    >
                      {row.amountCents >= 0 ? (
                        <ArrowDownLeftIcon className="size-4" />
                      ) : (
                        <ArrowUpRightIcon className="size-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatBookedDate(row.bookedAt)}</span>
                      <span className="text-xs text-muted-foreground">{row.accountName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xs flex-col">
                      <span className="truncate font-medium">{row.counterpartyName || "Unbekannte Gegenpartei"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.description || row.reference || "Kein Verwendungszweck"}
                      </span>
                      {row.documentCount > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                          <FileTextIcon className="size-3" /> Beleg hinterlegt
                        </span>
                      ) : null}
                      {row.matchedBooking && row.status !== "posted" && row.status !== "ignored" ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto justify-start p-0 text-xs text-primary"
                          disabled={assigningId === row.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void assignBooking(row);
                          }}
                        >
                          {assigningId === row.id
                            ? "Wird zugewiesen …"
                            : `Auftrag ${row.matchedBooking.orderNumber} zuweisen`}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "posted" && row.euerTreatment !== "needs_review"
                          ? "default"
                          : row.status === "ignored"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {statusLabel(row.status, row.euerTreatment)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${row.amountCents >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {row.amountCents >= 0 ? "+" : "−"}
                    {formatAmount(Math.abs(row.amountCents), row.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <FinancialTransactionDialog
        mode="bank"
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        categories={categories}
        accounts={accounts}
        bankTransaction={selected}
        onBankCompleted={({ transactionId, status, euerTreatment }) => {
          setRows((current) =>
            current.map((row) =>
              row.id === transactionId ? { ...row, status, euerTreatment: euerTreatment ?? row.euerTreatment } : row,
            ),
          );
          setSelected(null);
        }}
      />
    </section>
  );
}
