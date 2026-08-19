"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeftIcon, ArrowUpRightIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NevloSyncButton } from "@/components/nevlo-sync-button";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bookingPresentation } from "@/lib/bookings/presentation";

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
  allocationKind: string | null;
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

function bookingStatusLabel(status: string) {
  return bookingPresentation[status as keyof typeof bookingPresentation]?.label ?? status;
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
  const router = useRouter();
  const [rows, setRows] = useState(transactions);
  const [selected, setSelected] = useState<FinancialReviewTransaction | null>(null);
  const initialReviewOpened = useRef(false);
  const openCount = rows.filter((row) => row.status !== "posted" && row.status !== "ignored").length;
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignmentRow, setAssignmentRow] = useState<FinancialReviewTransaction | null>(null);
  const [assignmentBookingId, setAssignmentBookingId] = useState("");
  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) => {
        const dateDifference = right.bookedAt.localeCompare(left.bookedAt);
        return dateDifference || right.id - left.id;
      }),
    [rows],
  );

  function openBookingAssignment(row: FinancialReviewTransaction) {
    setAssignmentRow(row);
    setAssignmentBookingId(row.matchedBooking ? String(row.matchedBooking.id) : "");
  }

  async function assignBooking(row: FinancialReviewTransaction, bookingId: number) {
    setAssigningId(row.id);
    try {
      const response = await fetch(`/api/admin/financial/transactions/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_booking", bookingId }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ?? "Der Auftrag konnte nicht zugewiesen werden. Prüfe Buchung, Standort und Zahlungsstatus.",
        );
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: "posted" } : item)));
      router.refresh();
      const booking = bookings.find((item) => item.id === bookingId);
      toast.success(`Auftrag ${booking?.orderNumber ?? bookingId} wurde zugewiesen.`);
      setAssignmentRow(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Der Auftrag konnte nicht zugewiesen werden. Prüfe Buchung, Standort und Zahlungsstatus.",
      );
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
          <ManualFinancialTransactionLauncher
            categories={categories}
            accounts={accounts}
            bookings={bookings}
            onCompleted={() => router.refresh()}
          />
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
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Noch keine Finanztransaktionen erfasst.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
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
                      {row.source === "bank" &&
                      row.amountCents > 0 &&
                      row.status !== "posted" &&
                      row.status !== "ignored" ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto justify-start p-0 text-xs text-primary"
                          disabled={assigningId === row.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (row.matchedBooking) void assignBooking(row, row.matchedBooking.id);
                            else openBookingAssignment(row);
                          }}
                        >
                          {assigningId === row.id
                            ? "Wird zugewiesen …"
                            : row.matchedBooking
                              ? `Auftrag ${row.matchedBooking.orderNumber} zuweisen`
                              : "Auftrag zuweisen"}
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
      <Dialog
        open={Boolean(assignmentRow)}
        onOpenChange={(open) => {
          if (!open && !assigningId) setAssignmentRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bankzahlung einem Auftrag zuweisen</DialogTitle>
            <DialogDescription>
              Der Betrag wird dem ausgewählten Auftrag zugeordnet. Das Angebot oder der Buchungsstatus wird dabei nicht
              automatisch geändert.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="financial-assignment-booking">Auftrag</FieldLabel>
            <Select value={assignmentBookingId} onValueChange={(value) => setAssignmentBookingId(value ?? "")}>
              <SelectTrigger id="financial-assignment-booking" className="w-full">
                <SelectValue placeholder="Auftrag auswählen" />
              </SelectTrigger>
              <SelectContent>
                {bookings
                  .filter((booking) => booking.status !== "rejected" && booking.status !== "cancelled")
                  .map((booking) => (
                    <SelectItem key={booking.id} value={String(booking.id)}>
                      {booking.orderNumber} · {booking.customerName} · {booking.status}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Zulässig sind bestehende Aufträge in einem sinnvollen Zahlungsstatus, unabhängig davon, ob ein Angebot
              existiert oder bereits abgelaufen ist.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignmentRow(null)}
              disabled={Boolean(assigningId)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={!assignmentRow || !assignmentBookingId || Boolean(assigningId)}
              onClick={() => {
                if (assignmentRow && assignmentBookingId)
                  void assignBooking(assignmentRow, Number(assignmentBookingId));
              }}
            >
              {assigningId ? "Wird zugewiesen …" : "Zahlung zuweisen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FinancialTransactionDialog
        mode="bank"
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        categories={categories}
        accounts={accounts}
        bookings={bookings}
        bankTransaction={selected}
        onBankCompleted={({ transactionId, status, euerTreatment }) => {
          setRows((current) =>
            current.map((row) =>
              row.id === transactionId ? { ...row, status, euerTreatment: euerTreatment ?? row.euerTreatment } : row,
            ),
          );
          router.refresh();
          setSelected(null);
        }}
      />
    </section>
  );
}
