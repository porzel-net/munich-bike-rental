"use client";

import * as React from "react";
import { toast } from "sonner";
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
  EllipsisVerticalIcon,
} from "lucide-react";

import { FixedAssetDisposalDialog } from "@/components/fixed-asset-disposal-dialog";
import { FixedAssetEditDialog } from "@/components/fixed-asset-edit-dialog";
import { PrivateAssetContributionLauncher } from "@/components/private-asset-contribution-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly } from "@/lib/datetime";

export type FixedAssetRow = {
  id: number;
  assetNumber: string;
  name: string;
  assetType: "bike" | "equipment" | "other";
  method: "straight_line" | "declining_balance";
  acquisitionSource: "transaction" | "private_contribution";
  acquisitionDate: string;
  sourceTransactionId: number | null;
  originalAcquisitionDate: string | null;
  originalAcquisitionCostCents: number | null;
  originalUsefulLifeMonths: number | null;
  originalCondition: "new" | "used" | null;
  privateUseType: "personal" | "income_generation" | "mixed" | null;
  preEntryDepreciationCents: number;
  inServiceDate: string;
  serialNumber: string | null;
  acquisitionCostCents: number;
  usefulLifeMonths: number;
  status: string;
  postedDepreciationCents: number;
  bookValueCents: number;
};

type FinancialAccountOption = { id: number; code: string; name: string };
type StatusFilter = "all" | "active" | "disposed";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));
const statusFilterItems = [
  { value: "all", label: "Alle Status" },
  { value: "active", label: "Aktiv" },
  { value: "disposed", label: "Ausgeschieden" },
] as const;

function formatDate(value: string) {
  return formatDateOnly(value.slice(0, 10));
}

function assetTypeLabel(value: string) {
  if (value === "bike") return "Fahrrad";
  if (value === "equipment") return "Ausstattung";
  return "Sonstiges";
}

function methodLabel(value: FixedAssetRow["method"]) {
  return value === "declining_balance" ? "degressiv" : "linear";
}

const fixedAssetGlobalFilter: FilterFn<FixedAssetRow> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;

  return [row.original.name, row.original.assetNumber, row.original.serialNumber]
    .filter(Boolean)
    .some((item) => item!.toLocaleLowerCase("de-DE").includes(search));
};

function SortableColumnHeader({
  column,
  children,
  align = "left",
}: {
  column: Column<FixedAssetRow, unknown>;
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

function FixedAssetActions({
  asset,
  financialAccounts,
  onEdit,
}: {
  asset: FixedAssetRow;
  financialAccounts: FinancialAccountOption[];
  onEdit: (asset: FixedAssetRow) => void;
}) {
  const [disposalOpen, setDisposalOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function deleteAsset(event?: React.MouseEvent) {
    event?.preventDefault();
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/financial/assets/${asset.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Das Anlagegut konnte nicht gelöscht werden.");
      toast.success("Anlagegut und zugehörige AfA wurden gelöscht.");
      setDeleteOpen(false);
      window.location.reload();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Das Anlagegut konnte nicht gelöscht werden.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" className="data-open:bg-muted" />}
            aria-label={`Aktionen für ${asset.name}`}
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Aktionen für {asset.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {asset.status === "active" ? (
              <DropdownMenuItem onClick={() => onEdit(asset)}>Bearbeiten</DropdownMenuItem>
            ) : null}
            {asset.status === "active" ? (
              <DropdownMenuItem onClick={() => setDisposalOpen(true)}>Verkauf erfassen</DropdownMenuItem>
            ) : null}
            {asset.acquisitionSource === "private_contribution" &&
            asset.sourceTransactionId === null &&
            asset.status === "active" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Löschen
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <FixedAssetDisposalDialog
        asset={asset}
        financialAccounts={financialAccounts}
        open={disposalOpen}
        onOpenChange={setDisposalOpen}
      />
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleteBusy && setDeleteOpen(open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Anlagegut endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{asset.name}“ und alle zugehörigen AfA-Datensätze werden aus dem Anlageverzeichnis entfernt. Die
              ursprünglichen Journalbuchungen bleiben erhalten und werden durch Korrekturbuchungen neutralisiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => void deleteAsset(event)}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Wird gelöscht …" : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getFixedAssetColumns(
  financialAccounts: FinancialAccountOption[],
  onEdit: (asset: FixedAssetRow) => void,
): ColumnDef<FixedAssetRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableColumnHeader column={column}>Anlagegut</SortableColumnHeader>,
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <div>
            <div className="font-medium">{asset.name}</div>
            <div className="text-xs text-muted-foreground">
              {assetTypeLabel(asset.assetType)} · {methodLabel(asset.method)} · {asset.assetNumber} ·{" "}
              {asset.status === "active" ? "aktiv" : "ausgeschieden"}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "acquisitionDate",
      header: ({ column }) => <SortableColumnHeader column={column}>Anschaffung / Einlage</SortableColumnHeader>,
      cell: ({ row }) => {
        const asset = row.original;
        return asset.acquisitionSource === "private_contribution" ? (
          <>
            <div>Einlage: {formatDate(asset.acquisitionDate)}</div>
            <div className="text-xs text-muted-foreground">
              Kauf: {asset.originalAcquisitionDate ? formatDate(asset.originalAcquisitionDate) : "unbekannt"}
            </div>
          </>
        ) : (
          formatDate(asset.acquisitionDate)
        );
      },
    },
    {
      accessorKey: "usefulLifeMonths",
      header: ({ column }) => <SortableColumnHeader column={column}>Nutzungsdauer</SortableColumnHeader>,
      cell: ({ row }) => `${row.original.usefulLifeMonths} Monate`,
    },
    {
      accessorKey: "postedDepreciationCents",
      header: ({ column }) => <SortableColumnHeader column={column}>AfA gebucht</SortableColumnHeader>,
      cell: ({ row }) => euro.format(row.original.postedDepreciationCents / 100),
    },
    {
      accessorKey: "bookValueCents",
      header: ({ column }) => <SortableColumnHeader column={column}>Buchwert</SortableColumnHeader>,
      cell: ({ row }) => euro.format(row.original.bookValueCents / 100),
    },
    {
      accessorKey: "acquisitionCostCents",
      header: ({ column }) => (
        <SortableColumnHeader column={column} align="right">
          Wert
        </SortableColumnHeader>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold tabular-nums">
          {euro.format(row.original.acquisitionCostCents / 100)}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        return <FixedAssetActions asset={row.original} financialAccounts={financialAccounts} onEdit={onEdit} />;
      },
    },
  ];
}

export function FixedAssetsTable({
  assets,
  financialAccounts,
}: {
  assets: FixedAssetRow[];
  financialAccounts: FinancialAccountOption[];
}) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [editingAsset, setEditingAsset] = React.useState<FixedAssetRow | null>(null);

  const filteredAssets = React.useMemo(
    () => (statusFilter === "all" ? assets : assets.filter((asset) => asset.status === statusFilter)),
    [assets, statusFilter],
  );
  const columns = React.useMemo(() => getFixedAssetColumns(financialAccounts, setEditingAsset), [financialAccounts]);
  // TanStack Table exposes an intentionally mutable table instance; React Compiler cannot memoize it safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredAssets,
    columns,
    state: { globalFilter, sorting, columnVisibility, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: fixedAssetGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1">
            <div className="flex-1">
              <label htmlFor="fixed-assets-search" className="sr-only">
                Anlagegüter durchsuchen
              </label>
              <Input
                id="fixed-assets-search"
                placeholder="Anlagegut, Nummer oder Seriennummer suchen …"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="w-full sm:max-w-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              items={statusFilterItems}
              value={statusFilter}
              onValueChange={(value) => setStatusFilter((value ?? "all") as StatusFilter)}
            >
              <SelectTrigger className="w-44" aria-label="Status filtern">
                <SelectValue className="truncate text-sm font-normal">
                  {statusFilterItems.find((item) => item.value === statusFilter)?.label ?? "Alle Status"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusFilterItems.map((item) => (
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
              <DropdownMenuContent align="end" className="w-48">
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id === "name"
                        ? "Anlagegut"
                        : column.id === "acquisitionDate"
                          ? "Anschaffung / Einlage"
                          : column.id === "usefulLifeMonths"
                            ? "Nutzungsdauer"
                            : column.id === "postedDepreciationCents"
                              ? "AfA gebucht"
                              : column.id === "bookValueCents"
                                ? "Buchwert"
                                : "Wert"}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <PrivateAssetContributionLauncher />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
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
                    data-state={row.getIsSelected() && "selected"}
                    className={row.original.status === "active" ? "cursor-pointer" : undefined}
                    onClick={() => row.original.status === "active" && setEditingAsset(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                    {assets.length && filteredRowCount === 0
                      ? "Keine Anlagegüter entsprechen den Filtern."
                      : "Noch keine Anlagegüter erfasst."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            {filteredRowCount} {filteredRowCount === 1 ? "Anlagegut" : "Anlagegüter"}
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

        {editingAsset ? (
          <FixedAssetEditDialog asset={editingAsset} open onOpenChange={(open) => !open && setEditingAsset(null)} />
        ) : null}
      </CardContent>
    </Card>
  );
}
