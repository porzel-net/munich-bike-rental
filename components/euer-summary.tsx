"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import type {
  FinancialReviewAccount,
  FinancialReviewBooking,
  FinancialReviewCategory,
} from "@/components/financial-review-inbox";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EuerRow, EuerSummary } from "@/lib/financial/euer";
import { formatDateOnly } from "@/lib/datetime";

const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));
const treatmentFilterItems = [
  { value: "all", label: "Alle Wirkungen" },
  { value: "income", label: "Einnahme" },
  { value: "expense", label: "Ausgabe" },
  { value: "tax_payment", label: "USt-Zahlung" },
  { value: "input_vat", label: "Vorsteuer" },
  { value: "output_vat", label: "Umsatzsteuer" },
  { value: "needs_review", label: "Prüfung offen" },
] as const;

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

function SortableEuerHeader({
  column,
  children,
  align = "left",
}: {
  column: Column<EuerRow, unknown>;
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

const euerGlobalFilter: FilterFn<EuerRow> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;
  return [
    row.original.category,
    displayDescription(row.original),
    displaySource(row.original),
    row.original.invoiceNumber,
    row.original.accountName,
    formatDate(row.original.date),
  ]
    .filter(Boolean)
    .some((item) => item!.toLocaleLowerCase("de-DE").includes(search));
};

function getEuerColumns(): ColumnDef<EuerRow>[] {
  return [
    {
      accessorKey: "date",
      header: ({ column }) => <SortableEuerHeader column={column}>Datum</SortableEuerHeader>,
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "category",
      header: ({ column }) => <SortableEuerHeader column={column}>Kategorie</SortableEuerHeader>,
      cell: ({ row }) => <span className="font-medium">{row.original.category}</span>,
    },
    {
      id: "sourceDescription",
      accessorFn: (row) => displayDescription(row),
      header: ({ column }) => <SortableEuerHeader column={column}>Quelle / Beschreibung</SortableEuerHeader>,
      cell: ({ row }) => (
        <div className="min-w-0 max-w-80">
          <span className="block max-w-full truncate" title={displayDescription(row.original)}>
            {displayDescription(row.original)}
          </span>
          <span className="block max-w-full truncate text-xs text-muted-foreground" title={displaySource(row.original)}>
            {displaySource(row.original)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => <SortableEuerHeader column={column}>Rechnungsnummer</SortableEuerHeader>,
      cell: ({ row }) => <span className="font-medium">{row.original.invoiceNumber ?? "—"}</span>,
    },
    {
      accessorKey: "euerTreatment",
      header: ({ column }) => <SortableEuerHeader column={column}>Wirkung</SortableEuerHeader>,
      cell: ({ row }) => treatmentLabel(row.original.euerTreatment),
    },
    {
      accessorKey: "amountCents",
      header: ({ column }) => (
        <SortableEuerHeader column={column} align="right">
          Betrag
        </SortableEuerHeader>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold tabular-nums">{formatAmount(displayRowAmount(row.original))}</div>
      ),
    },
  ];
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
  const euerRows = React.useMemo(
    () =>
      data.rows.filter((row) =>
        ["income", "expense", "tax_payment", "input_vat", "output_vat", "needs_review"].includes(row.euerTreatment),
      ),
    [data.rows],
  );
  const profitMargin = data.incomeCents > 0 ? (data.profitCents / data.incomeCents) * 100 : 0;
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [treatmentFilter, setTreatmentFilter] = React.useState("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const filteredRows = React.useMemo(
    () => (treatmentFilter === "all" ? euerRows : euerRows.filter((row) => row.euerTreatment === treatmentFilter)),
    [euerRows, treatmentFilter],
  );
  const columns = React.useMemo(() => getEuerColumns(), []);
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
    globalFilterFn: euerGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visibleRows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);
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
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Kategorie, Beschreibung oder Konto suchen …"
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
                aria-label="EÜR durchsuchen"
                className="w-full sm:max-w-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                items={treatmentFilterItems}
                value={treatmentFilter}
                onValueChange={(value) => {
                  setTreatmentFilter(value ?? "all");
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-44" aria-label="EÜR-Wirkung filtern">
                  <SelectValue className="truncate text-sm font-normal">
                    {treatmentFilterItems.find((item) => item.value === treatmentFilter)?.label ?? "Alle Wirkungen"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {treatmentFilterItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
                        {column.id === "sourceDescription"
                          ? "Quelle / Beschreibung"
                          : column.id === "invoiceNumber"
                            ? "Rechnungsnummer"
                            : column.id === "euerTreatment"
                              ? "Wirkung"
                              : column.id === "amountCents"
                                ? "Betrag"
                                : column.id === "category"
                                  ? "Kategorie"
                                  : "Datum"}
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
                  visibleRows.map((row) => {
                    const target = rowTarget(row.original);
                    return (
                      <TableRow
                        key={row.id}
                        className={[
                          row.original.euerTreatment === "transfer" ? "text-muted-foreground" : "",
                          target ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        tabIndex={target ? 0 : undefined}
                        onClick={() => target && router.push(target)}
                        onKeyDown={(event) => {
                          if (!target || (event.key !== "Enter" && event.key !== " ")) return;
                          event.preventDefault();
                          router.push(target);
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {euerRows.length && filteredRowCount === 0
                        ? "Keine EÜR-Positionen entsprechen den Filtern."
                        : "Noch keine gebuchten EÜR-Positionen."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              {filteredRowCount} {filteredRowCount === 1 ? "EÜR-Position" : "EÜR-Positionen"}
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
    </section>
  );
}
