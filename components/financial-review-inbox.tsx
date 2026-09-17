"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeftIcon,
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FileTextIcon,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Column,
  type ColumnDef,
  type FilterFn,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NevloSyncButton } from "@/components/nevlo-sync-button";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { BUSINESS_TIME_ZONE } from "@/lib/datetime";
import { countOpenFinancialReviews, getFinancialReviewState } from "@/lib/financial/review-status";

const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));

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
  provider: string | null;
  kind: string;
  status: string;
  euerTreatment: string | null;
  categoryId: number | null;
  categoryCode: string | null;
  categoryType: string | null;
  euerLine: string | null;
  allocationKind: string | null;
  bookingId: number | null;
  destinationAccountId: number | null;
  fixedAssetId: number | null;
  amountCents: number;
  allocatedCents: number;
  privateShareCents: number;
  remainingCents: number;
  currency: string;
  bookedAt: string;
  valueDate: string | null;
  counterpartyName: string | null;
  reference: string;
  description: string;
  notes: string;
  documentCount: number;
  documents: Array<{ id: number; originalFileName: string; mimeType?: string; sizeBytes?: number }>;
  fixedAsset: {
    id: number;
    name: string;
    assetType: "bike" | "equipment" | "other";
    method: "straight_line" | "declining_balance";
    serialNumber: string | null;
    acquisitionDate: string;
    inServiceDate: string;
    acquisitionCostCents: number;
    usefulLifeMonths: number;
  } | null;
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
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE }).format(date)
    : "Datum unbekannt";
}

function formatAmount(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

function statusLabel(row: FinancialReviewTransaction) {
  const reviewState = getFinancialReviewState(row);
  if (reviewState.status === "ignored") return "Ignoriert";
  if (reviewState.missing.includes("document")) return "Beleg fehlt";
  if (reviewState.status === "posted") return "Gebucht & abgestimmt";
  return "Prüfung offen";
}

function bookingStatusLabel(status: string) {
  return bookingPresentation[status as keyof typeof bookingPresentation]?.label ?? status;
}

type TransactionStatusFilter = "all" | "needs_review" | "posted" | "ignored";
const transactionStatusItems = [
  { value: "all", label: "Alle Status" },
  { value: "needs_review", label: "Prüfung offen" },
  { value: "posted", label: "Gebucht" },
  { value: "ignored", label: "Ignoriert" },
] as const;

function SortableTransactionHeader({
  column,
  children,
  align = "left",
}: {
  column: Column<FinancialReviewTransaction, unknown>;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={align === "right" ? "-mr-3 ml-auto" : "-ml-3"}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

const financialTransactionGlobalFilter: FilterFn<FinancialReviewTransaction> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;

  return [
    row.original.accountName,
    row.original.accountCode,
    row.original.counterpartyName,
    row.original.description,
    row.original.reference,
    row.original.matchedBooking?.orderNumber,
    statusLabel(row.original),
    String(row.original.id),
  ]
    .filter(Boolean)
    .some((item) => item!.toLocaleLowerCase("de-DE").includes(search));
};

function canAssignBooking(row: FinancialReviewTransaction) {
  return (
    row.source === "bank" &&
    row.amountCents > 0 &&
    row.remainingCents > 0 &&
    row.status !== "posted" &&
    row.status !== "ignored"
  );
}

function getFinancialTransactionColumns({
  openBookingAssignment,
  assignBooking,
  assigningId,
  openCount,
}: {
  openBookingAssignment: (row: FinancialReviewTransaction) => void;
  assignBooking: (row: FinancialReviewTransaction, bookingId: number) => Promise<void>;
  assigningId: number | null;
  openCount: number;
}): ColumnDef<FinancialReviewTransaction>[] {
  return [
    {
      id: "direction",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div
          className={`flex size-8 items-center justify-center rounded-md ${row.original.amountCents >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
        >
          {row.original.amountCents >= 0 ? (
            <ArrowDownLeftIcon className="size-4" />
          ) : (
            <ArrowUpRightIcon className="size-4" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "bookedAt",
      header: ({ column }) => <SortableTransactionHeader column={column}>Datum / Konto</SortableTransactionHeader>,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatBookedDate(row.original.bookedAt)}</span>
          <span className="text-xs text-muted-foreground">{row.original.accountName}</span>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <SortableTransactionHeader column={column}>Gegenpartei / Verwendungszweck</SortableTransactionHeader>
      ),
      cell: ({ row }) => {
        const transaction = row.original;
        return (
          <div className="min-w-0 max-w-80">
            <span
              className="block max-w-full truncate font-medium"
              title={transaction.counterpartyName || "Unbekannte Gegenpartei"}
            >
              {transaction.counterpartyName || "Unbekannte Gegenpartei"}
            </span>
            <span
              className="block max-w-full truncate text-xs text-muted-foreground"
              title={transaction.description || transaction.reference || "Kein Verwendungszweck"}
            >
              {transaction.description || transaction.reference || "Kein Verwendungszweck"}
            </span>
            {transaction.documentCount > 0 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                <FileTextIcon className="size-3" /> Beleg hinterlegt
              </span>
            ) : null}
            {canAssignBooking(transaction) ? (
              <Button
                type="button"
                variant="link"
                className="h-auto justify-start p-0 text-xs text-primary"
                disabled={assigningId === transaction.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (transaction.matchedBooking) void assignBooking(transaction, transaction.matchedBooking.id);
                  else openBookingAssignment(transaction);
                }}
              >
                {assigningId === transaction.id
                  ? "Wird zugewiesen …"
                  : transaction.matchedBooking
                    ? `Auftrag ${transaction.matchedBooking.orderNumber} zuweisen`
                    : "Auftrag zuweisen"}
              </Button>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "status",
      accessorFn: (row) => getFinancialReviewState(row).status,
      header: ({ column }) => (
        <div className="flex items-center gap-2">
          <SortableTransactionHeader column={column}>Status</SortableTransactionHeader>
          <Badge variant={openCount ? "destructive" : "outline"}>{openCount} offen</Badge>
        </div>
      ),
      cell: ({ row }) => {
        const transaction = row.original;
        const reviewState = getFinancialReviewState(transaction);
        return (
          <Badge
            variant={
              reviewState.status === "posted" ? "default" : reviewState.status === "ignored" ? "outline" : "destructive"
            }
          >
            {statusLabel(transaction)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "amountCents",
      header: ({ column }) => (
        <SortableTransactionHeader column={column} align="right">
          Betrag
        </SortableTransactionHeader>
      ),
      cell: ({ row }) => (
        <div
          className={`text-right font-semibold tabular-nums ${row.original.amountCents >= 0 ? "text-emerald-600" : "text-destructive"}`}
        >
          {row.original.amountCents >= 0 ? "+" : "−"}
          {formatAmount(Math.abs(row.original.amountCents), row.original.currency)}
        </div>
      ),
    },
  ];
}

export function FinancialReviewActions() {
  return <NevloSyncButton />;
}

export function FinancialReviewInbox({
  transactions,
  categories,
  accounts,
  bookings,
  initialTransactionId,
}: {
  transactions: FinancialReviewTransaction[];
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  bookings: FinancialReviewBooking[];
  initialTransactionId?: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FinancialReviewTransaction | null>(null);
  const initialReviewOpened = useRef(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignmentRow, setAssignmentRow] = useState<FinancialReviewTransaction | null>(null);
  const [assignmentBookingId, setAssignmentBookingId] = useState("");
  const [assignmentAmount, setAssignmentAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const sortedRows = useMemo(
    () =>
      [...transactions].sort((left, right) => {
        const dateDifference = right.bookedAt.localeCompare(left.bookedAt);
        return dateDifference || right.id - left.id;
      }),
    [transactions],
  );
  const openCount = countOpenFinancialReviews(transactions);

  const openBookingAssignment = useCallback((row: FinancialReviewTransaction) => {
    setAssignmentRow(row);
    setAssignmentBookingId(row.matchedBooking ? String(row.matchedBooking.id) : "");
    setAssignmentAmount((Math.max(0, row.remainingCents) / 100).toFixed(2));
  }, []);

  const assignBooking = useCallback(
    async (row: FinancialReviewTransaction, bookingId: number, amountCents = row.remainingCents) => {
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > row.remainingCents) {
        toast.error("Bitte gib einen gültigen Teilbetrag innerhalb des offenen Bankbetrags an.");
        return;
      }
      setAssigningId(row.id);
      try {
        const response = await fetch(`/api/admin/financial/transactions/${row.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign_booking", bookingId, amountCents }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok)
          throw new Error(
            result?.message ??
              "Der Auftrag konnte nicht zugewiesen werden. Prüfe Buchung, Standort und Zahlungsstatus.",
          );
        const booking = bookings.find((item) => item.id === bookingId);
        router.refresh();
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
    },
    [bookings, router],
  );

  const openReview = useCallback((row: FinancialReviewTransaction) => {
    setSelected(row);
  }, []);

  const filteredRows = useMemo(
    () =>
      statusFilter === "all"
        ? sortedRows
        : sortedRows.filter((row) => getFinancialReviewState(row).status === statusFilter),
    [sortedRows, statusFilter],
  );
  const columns = useMemo(
    () =>
      getFinancialTransactionColumns({
        openBookingAssignment,
        assignBooking,
        assigningId,
        openCount,
      }),
    [assignBooking, assigningId, openBookingAssignment, openCount],
  );
  // TanStack Table exposes an intentionally mutable table instance; React Compiler cannot memoize it safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { globalFilter, sorting, columnVisibility, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: financialTransactionGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  useEffect(() => {
    if (!initialTransactionId || initialReviewOpened.current) return;
    const initialRow = transactions.find((row) => row.id === initialTransactionId);
    if (!initialRow) return;
    initialReviewOpened.current = true;
    const timer = window.setTimeout(() => openReview(initialRow), 0);
    return () => window.clearTimeout(timer);
  }, [initialTransactionId, openReview, transactions]);

  return (
    <section className="flex flex-col gap-4">
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="financial-transactions-search" className="sr-only">
                  Finanztransaktionen durchsuchen
                </label>
                <Input
                  id="financial-transactions-search"
                  placeholder="Gegenpartei, Verwendungszweck oder Konto suchen …"
                  value={globalFilter}
                  onChange={(event) => {
                    setGlobalFilter(event.target.value);
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                  className="w-full sm:max-w-sm"
                />
              </div>
              <Select
                items={transactionStatusItems}
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter((value ?? "all") as TransactionStatusFilter);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-44" aria-label="Status filtern">
                  <SelectValue className="truncate text-sm font-normal">
                    {transactionStatusItems.find((item) => item.value === statusFilter)?.label ?? "Alle Status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {transactionStatusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                  Spalten
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id === "bookedAt"
                          ? "Datum / Konto"
                          : column.id === "description"
                            ? "Gegenpartei / Verwendungszweck"
                            : column.id === "status"
                              ? "Status"
                              : "Betrag"}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ManualFinancialTransactionLauncher
                categories={categories}
                accounts={accounts}
                bookings={bookings}
                onCompleted={() => router.refresh()}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <Table className="text-sm [&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
                      tabIndex={0}
                      onClick={() => openReview(row.original)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openReview(row.original);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="h-28 text-center text-muted-foreground"
                    >
                      {transactions.length && filteredRowCount === 0
                        ? "Keine Finanztransaktionen entsprechen den Filtern."
                        : "Noch keine Finanztransaktionen erfasst."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              {filteredRowCount} {filteredRowCount === 1 ? "Finanztransaktion" : "Finanztransaktionen"}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Zeilen pro Seite</span>
                <Select
                  items={pageSizeItems}
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger size="sm" className="w-20" aria-label="Zeilen pro Seite">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      {pageSizeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-28 text-center font-medium text-foreground">
                Seite {table.getState().pagination.pageIndex + 1} von {pageCount}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="hidden sm:inline-flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Erste Seite</span>
                  <ChevronsLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Vorherige Seite</span>
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Nächste Seite</span>
                  <ChevronRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="hidden sm:inline-flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Letzte Seite</span>
                  <ChevronsRightIcon />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
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
              Weise den ganzen Bankbetrag oder nur einen Teil davon zu. Der verbleibende Betrag bleibt zur weiteren
              Prüfung offen; Angebot und Buchungsstatus werden dabei nicht automatisch geändert.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="financial-assignment-amount">Zuzuweisender Betrag</FieldLabel>
            <Input
              id="financial-assignment-amount"
              type="number"
              min="0.01"
              max={assignmentRow ? (assignmentRow.remainingCents / 100).toFixed(2) : undefined}
              step="0.01"
              value={assignmentAmount}
              onChange={(event) => setAssignmentAmount(event.target.value)}
              disabled={Boolean(assigningId)}
            />
            <FieldDescription>
              Noch offen: {assignmentRow ? formatAmount(assignmentRow.remainingCents, assignmentRow.currency) : "—"}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="financial-assignment-booking">Auftrag</FieldLabel>
            <Select value={assignmentBookingId} onValueChange={(value) => setAssignmentBookingId(value ?? "")}>
              <SelectTrigger id="financial-assignment-booking" className="w-full">
                <SelectValue placeholder="Auftrag auswählen">
                  {(value) => {
                    const booking = bookings.find((item) => String(item.id) === String(value));
                    return booking
                      ? `${booking.orderNumber} · ${booking.customerName} · ${bookingStatusLabel(booking.status)}`
                      : "Auftrag auswählen";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bookings
                  .filter((booking) => booking.status !== "rejected" && booking.status !== "cancelled")
                  .map((booking) => (
                    <SelectItem key={booking.id} value={String(booking.id)}>
                      {booking.orderNumber} · {booking.customerName} · {bookingStatusLabel(booking.status)}
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
                if (assignmentRow && assignmentBookingId) {
                  const amountCents = Math.round(Number(assignmentAmount.replace(",", ".")) * 100);
                  void assignBooking(assignmentRow, Number(assignmentBookingId), amountCents);
                }
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
        onDocumentChanged={() => router.refresh()}
        onBankCompleted={() => {
          router.refresh();
          setSelected(null);
        }}
      />
    </section>
  );
}
