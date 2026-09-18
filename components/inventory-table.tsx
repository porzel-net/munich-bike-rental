"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
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

import type { AdminInventoryBike, AdminInventoryEquipment } from "@/app/admin/inventory/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  defaultUncountedEquipmentCategories,
  equipmentCategories,
  equipmentCategoryLabels,
  type EquipmentCategory,
} from "@/lib/inventory/equipment-categories";
import { compareInventoryBikes } from "@/lib/inventory/sorting";

type LocationOption = { key: AdminInventoryBike["location"]; label: string };
type InventoryKind = "bike" | "equipment";
type InventoryKindFilter = "all" | InventoryKind;
type EditingItem = (AdminInventoryBike & { kind: "bike" }) | (AdminInventoryEquipment & { kind: "equipment" });
type LocationFilter = "all" | LocationOption["key"];

function SortableInventoryHeader({
  column,
  children,
  align = "left",
}: {
  column: Column<EditingItem, unknown>;
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

const inventoryGlobalFilter: FilterFn<EditingItem> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;
  const item = row.original;
  const values =
    item.kind === "bike"
      ? ["bike", "fahrrad", item.title, item.nickname, item.frameNumber, item.size, item.location]
      : ["ausrüstung", "equipment", item.labelDe, item.labelEn, equipmentCategoryLabels[item.category], item.location];
  return values.filter(Boolean).some((entry) => entry!.toLocaleLowerCase("de-DE").includes(search));
};

function getInventoryColumns(
  kind: InventoryKindFilter,
  locations: LocationOption[],
  toggleLandingVisibility: (bike: AdminInventoryBike) => void,
  toggleAvailability: (item: EditingItem) => void,
): ColumnDef<EditingItem>[] {
  const locationLabel = (location: LocationOption["key"]) =>
    locations.find((entry) => entry.key === location)?.label ?? location;

  if (kind === "all") {
    return [
      {
        id: "name",
        accessorFn: (row) => (row.kind === "bike" ? row.nickname || row.title : row.labelDe),
        header: ({ column }) => <SortableInventoryHeader column={column}>Inventar</SortableInventoryHeader>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="font-medium">{item.kind === "bike" ? item.nickname || item.title : item.labelDe}</div>
              <div className="text-xs text-muted-foreground">
                {item.kind === "bike" ? item.title : equipmentCategoryLabels[item.category]}
              </div>
            </div>
          );
        },
      },
      {
        id: "type",
        accessorFn: (row) => (row.kind === "bike" ? "Bike" : "Ausrüstung"),
        header: ({ column }) => <SortableInventoryHeader column={column}>Typ</SortableInventoryHeader>,
        cell: ({ row }) => (row.original.kind === "bike" ? "Bike" : "Ausrüstung"),
      },
      {
        id: "location",
        accessorFn: (row) => locationLabel(row.location),
        header: ({ column }) => <SortableInventoryHeader column={column}>Standort</SortableInventoryHeader>,
        cell: ({ row }) => locationLabel(row.original.location),
      },
      {
        id: "details",
        accessorFn: (row) =>
          row.kind === "bike"
            ? `Größe ${row.size}`
            : row.quantityRelevant
              ? `${row.availableQuantity} Stück`
              : "Nicht gezählt",
        header: ({ column }) => <SortableInventoryHeader column={column}>Details</SortableInventoryHeader>,
        cell: ({ row }) => {
          const item = row.original;
          return item.kind === "bike"
            ? `Größe ${item.size}`
            : item.quantityRelevant
              ? `${item.availableQuantity} Stück`
              : "Nicht gezählt";
        },
      },
      {
        id: "landingPage",
        accessorFn: (row) => (row.kind === "bike" ? row.isVisibleOnLanding : null),
        header: "Landingpage",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.kind !== "bike") return <span className="text-muted-foreground">—</span>;
          const bike = row.original;
          return (
            <StatusButton
              active={bike.isVisibleOnLanding}
              onClick={() => toggleLandingVisibility(bike)}
              activeLabel="Angezeigt"
              inactiveLabel="Ausgeblendet"
            />
          );
        },
      },
      {
        id: "availability",
        accessorFn: (row) => (row.kind === "bike" ? row.isBookable : row.isAvailable),
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <StatusButton
            active={row.original.kind === "bike" ? row.original.isBookable : row.original.isAvailable}
            onClick={() => toggleAvailability(row.original)}
            activeLabel={row.original.kind === "bike" ? "Buchungen: an" : "Für Buchungen aktiv"}
            inactiveLabel={row.original.kind === "bike" ? "Buchungen: aus" : "Für Buchungen pausiert"}
          />
        ),
      },
      {
        id: "price",
        accessorFn: (row) => (row.kind === "bike" ? row.weekdayPriceCents : row.priceCents),
        header: ({ column }) => (
          <SortableInventoryHeader column={column} align="right">
            Preis
          </SortableInventoryHeader>
        ),
        cell: ({ row }) =>
          row.original.kind === "bike" ? (
            <div className="text-right font-semibold tabular-nums">
              <div>Mo-Fr {euroFormatter.format(row.original.weekdayPriceCents / 100)}</div>
              <div>Sa-So {euroFormatter.format(row.original.weekendPriceCents / 100)}</div>
            </div>
          ) : (
            <div className="text-right font-semibold tabular-nums">
              {euroFormatter.format(row.original.priceCents / 100)}
            </div>
          ),
      },
    ];
  }

  if (kind === "bike") {
    return [
      {
        id: "name",
        accessorFn: (row) => (row.kind === "bike" ? row.nickname || row.title : ""),
        header: ({ column }) => <SortableInventoryHeader column={column}>Bike / Typ</SortableInventoryHeader>,
        cell: ({ row }) => {
          const bike = row.original as AdminInventoryBike & { kind: "bike" };
          return (
            <div>
              <div className="font-medium">{bike.nickname || bike.title}</div>
              {bike.nickname ? <div className="text-xs text-muted-foreground">{bike.title}</div> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "size",
        header: ({ column }) => <SortableInventoryHeader column={column}>Größe</SortableInventoryHeader>,
      },
      {
        id: "location",
        accessorFn: (row) => locationLabel(row.location),
        header: ({ column }) => <SortableInventoryHeader column={column}>Standort</SortableInventoryHeader>,
        cell: ({ row }) => locationLabel(row.original.location),
      },
      {
        id: "landingPage",
        accessorFn: (row) => (row.kind === "bike" ? row.isVisibleOnLanding : false),
        header: "Landingpage",
        enableSorting: false,
        cell: ({ row }) => {
          const bike = row.original as AdminInventoryBike & { kind: "bike" };
          return (
            <StatusButton
              active={bike.isVisibleOnLanding}
              onClick={() => toggleLandingVisibility(bike)}
              activeLabel="Angezeigt"
              inactiveLabel="Ausgeblendet"
            />
          );
        },
      },
      {
        id: "bookable",
        accessorFn: (row) => (row.kind === "bike" ? row.isBookable : false),
        header: "Buchungen",
        enableSorting: false,
        cell: ({ row }) => {
          const bike = row.original as AdminInventoryBike & { kind: "bike" };
          return <StatusButton active={bike.isBookable} onClick={() => toggleAvailability(bike)} />;
        },
      },
      {
        accessorKey: "weekdayPriceCents",
        header: ({ column }) => (
          <SortableInventoryHeader column={column} align="right">
            Preise / Tag
          </SortableInventoryHeader>
        ),
        cell: ({ row }) => {
          const bike = row.original as AdminInventoryBike & { kind: "bike" };
          return (
            <div className="text-right font-semibold tabular-nums">
              <div>Mo-Fr {euroFormatter.format(bike.weekdayPriceCents / 100)}</div>
              <div>Sa-So {euroFormatter.format(bike.weekendPriceCents / 100)}</div>
            </div>
          );
        },
      },
    ];
  }

  return [
    {
      id: "category",
      accessorFn: (row) => (row.kind === "equipment" ? equipmentCategoryLabels[row.category] : ""),
      header: ({ column }) => <SortableInventoryHeader column={column}>Ausrüstung</SortableInventoryHeader>,
      cell: ({ row }) => (
        <span className="font-medium">
          {equipmentCategoryLabels[(row.original as AdminInventoryEquipment & { kind: "equipment" }).category]}
        </span>
      ),
    },
    {
      accessorKey: "labelDe",
      header: ({ column }) => <SortableInventoryHeader column={column}>Art</SortableInventoryHeader>,
    },
    {
      id: "location",
      accessorFn: (row) => locationLabel(row.location),
      header: ({ column }) => <SortableInventoryHeader column={column}>Standort</SortableInventoryHeader>,
      cell: ({ row }) => locationLabel(row.original.location),
    },
    {
      accessorKey: "availableQuantity",
      header: ({ column }) => (
        <SortableInventoryHeader column={column} align="right">
          Bestand
        </SortableInventoryHeader>
      ),
      cell: ({ row }) => {
        const item = row.original as AdminInventoryEquipment & { kind: "equipment" };
        return (
          <div className="text-right font-semibold tabular-nums">
            {item.quantityRelevant ? item.availableQuantity : "Nicht gezählt"}
          </div>
        );
      },
    },
    {
      id: "availability",
      accessorFn: (row) => (row.kind === "equipment" ? row.isAvailable : false),
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original as AdminInventoryEquipment & { kind: "equipment" };
        return <StatusButton active={item.isAvailable} onClick={() => toggleAvailability(item)} />;
      },
    },
    {
      accessorKey: "priceCents",
      header: ({ column }) => (
        <SortableInventoryHeader column={column} align="right">
          Preis
        </SortableInventoryHeader>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold tabular-nums">
          {euroFormatter.format((row.original as AdminInventoryEquipment & { kind: "equipment" }).priceCents / 100)}
        </div>
      ),
    },
  ];
}

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));
const allLocationsItem = { value: "all", label: "Alle Standorte" } as const;
const allInventoryKindsItem = { value: "all", label: "Alle Inventararten" } as const;
function priceToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".00", "");
}

export function InventoryTable({
  initialBikes,
  initialEquipment,
  locations,
  canManageAllLocations,
}: {
  initialBikes: AdminInventoryBike[];
  initialEquipment: AdminInventoryEquipment[];
  locations: LocationOption[];
  canManageAllLocations: boolean;
}) {
  const [bikes, setBikes] = useState(initialBikes);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [kindFilter, setKindFilter] = useState<InventoryKindFilter>("all");
  const [dialogKind, setDialogKind] = useState<InventoryKind>("bike");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(
    canManageAllLocations ? "all" : (locations[0]?.key ?? "all"),
  );
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const locationItems = [
    allLocationsItem,
    ...locations.map((location) => ({
      value: location.key,
      label: location.label,
    })),
  ] as const;
  const inventoryKindItems = [
    allInventoryKindsItem,
    { value: "bike", label: "Bikes" },
    { value: "equipment", label: "Ausrüstung" },
  ] as const;
  const selectedInventoryKindLabel =
    inventoryKindItems.find((item) => item.value === kindFilter)?.label ?? allInventoryKindsItem.label;
  const selectedLocationLabel =
    locationFilter === "all"
      ? allLocationsItem.label
      : locations.find((location) => location.key === locationFilter)?.label;

  const visibleBikes = useMemo(() => {
    const filtered = locationFilter === "all" ? bikes : bikes.filter((bike) => bike.location === locationFilter);
    return [...filtered].sort(compareInventoryBikes);
  }, [bikes, locationFilter]);
  const visibleEquipment = useMemo(
    () => (locationFilter === "all" ? equipment : equipment.filter((item) => item.location === locationFilter)),
    [equipment, locationFilter],
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const inventoryRows = useMemo<EditingItem[]>(
    () =>
      kindFilter === "bike"
        ? visibleBikes.map((bike) => ({ ...bike, kind: "bike" as const }))
        : kindFilter === "equipment"
          ? visibleEquipment.map((item) => ({ ...item, kind: "equipment" as const }))
          : [
              ...visibleBikes.map((bike) => ({ ...bike, kind: "bike" as const })),
              ...visibleEquipment.map((item) => ({ ...item, kind: "equipment" as const })),
            ],
    [kindFilter, visibleBikes, visibleEquipment],
  );
  // The callbacks only use stable React state setters and the row passed at click time.
  const columns = useMemo(
    () => getInventoryColumns(kindFilter, locations, toggleLandingVisibility, toggleAvailability),
    [kindFilter, locations],
  );
  // TanStack Table exposes an intentionally mutable table instance; React Compiler cannot memoize it safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: inventoryRows,
    columns,
    state: { globalFilter, sorting, columnVisibility, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: inventoryGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visibleRows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  function openCreate(nextKind: InventoryKind) {
    setDialogKind(nextKind);
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: EditingItem) {
    setDialogKind(item.kind);
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function toggleAvailability(item: EditingItem) {
    const payload =
      item.kind === "bike"
        ? {
            type: "bike" as const,
            id: item.id,
            location: item.location,
            title: item.title,
            nickname: item.nickname,
            frameNumber: item.frameNumber,
            size: item.size,
            weekdayPriceCents: item.weekdayPriceCents,
            weekendPriceCents: item.weekendPriceCents,
            isVisibleOnLanding: item.isVisibleOnLanding,
            isBookable: !item.isBookable,
          }
        : {
            type: "equipment" as const,
            id: item.id,
            location: item.location,
            category: item.category,
            labelDe: item.labelDe,
            labelEn: item.labelEn,
            priceCents: item.priceCents,
            availableQuantity: item.availableQuantity,
            quantityRelevant: item.quantityRelevant,
            isAvailable: !item.isAvailable,
          };
    const response = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    if (item.kind === "bike") {
      setBikes((current) =>
        current.map((bike) => (bike.id === item.id ? { ...bike, isBookable: !bike.isBookable } : bike)),
      );
    } else {
      setEquipment((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isAvailable: !entry.isAvailable } : entry)),
      );
    }
  }

  async function toggleLandingVisibility(item: AdminInventoryBike) {
    const response = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bike",
        id: item.id,
        location: item.location,
        title: item.title,
        nickname: item.nickname,
        frameNumber: item.frameNumber,
        size: item.size,
        weekdayPriceCents: item.weekdayPriceCents,
        weekendPriceCents: item.weekendPriceCents,
        isVisibleOnLanding: !item.isVisibleOnLanding,
        isBookable: item.isBookable,
      }),
    });
    if (!response.ok) return;
    setBikes((current) =>
      current.map((bike) => (bike.id === item.id ? { ...bike, isVisibleOnLanding: !bike.isVisibleOnLanding } : bike)),
    );
  }

  async function deleteItem(item: EditingItem) {
    const label = item.kind === "bike" ? item.nickname || item.title : item.labelDe;
    if (!window.confirm(`„${label}“ wirklich aus dem Inventar entfernen?`)) return;
    const response = await fetch("/api/admin/inventory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: item.kind, id: item.id, location: item.location }),
    });
    if (!response.ok) return;
    if (item.kind === "bike") setBikes((current) => current.filter((bike) => bike.id !== item.id));
    else setEquipment((current) => current.filter((entry) => entry.id !== item.id));
    setDialogOpen(false);
  }

  function handleSaved(item: AdminInventoryBike | AdminInventoryEquipment, itemKind: InventoryKind, isNew: boolean) {
    if (itemKind === "bike") {
      setBikes((current) =>
        isNew
          ? [...current, item as AdminInventoryBike]
          : current.map((bike) => (bike.id === item.id ? (item as AdminInventoryBike) : bike)),
      );
    } else {
      setEquipment((current) =>
        isNew
          ? [...current, item as AdminInventoryEquipment]
          : current.map((entry) => (entry.id === item.id ? (item as AdminInventoryEquipment) : entry)),
      );
    }
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <div data-inventory-controls className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1">
              <Input
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
                placeholder="Inventar suchen …"
                aria-label="Inventar durchsuchen"
                className="w-full sm:max-w-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select
                items={inventoryKindItems}
                value={kindFilter}
                onValueChange={(value) => {
                  if (!value) return;
                  setKindFilter(value as InventoryKindFilter);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-44" aria-label="Inventarart filtern">
                  <SelectValue className="text-sm font-normal">{selectedInventoryKindLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {inventoryKindItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {canManageAllLocations ? (
                <Select
                  items={locationItems}
                  value={locationFilter}
                  onValueChange={(value) => value && setLocationFilter(value as LocationFilter)}
                >
                  <SelectTrigger className="w-44" aria-label="Standort filtern">
                    <SelectValue className="text-sm font-normal">{selectedLocationLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {locationItems.map((location) => (
                        <SelectItem key={location.value} value={location.value}>
                          {location.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}
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
                        {kindFilter === "all"
                          ? column.id === "name"
                            ? "Inventar"
                            : column.id === "type"
                              ? "Typ"
                              : column.id === "location"
                                ? "Standort"
                                : column.id === "details"
                                  ? "Details"
                                  : column.id === "landingPage"
                                    ? "Landingpage"
                                    : column.id === "availability"
                                      ? "Status"
                                      : "Preis"
                          : kindFilter === "bike"
                            ? column.id === "name"
                              ? "Bike / Typ"
                              : column.id === "size"
                                ? "Größe"
                                : column.id === "location"
                                  ? "Standort"
                                  : column.id === "landingPage"
                                    ? "Landingpage"
                                    : column.id === "bookable"
                                      ? "Buchungen"
                                      : "Preise / Tag"
                            : column.id === "category"
                              ? "Ausrüstung"
                              : column.id === "labelDe"
                                ? "Art"
                                : column.id === "location"
                                  ? "Standort"
                                  : column.id === "availableQuantity"
                                    ? "Bestand"
                                    : column.id === "availability"
                                      ? "Status"
                                      : "Preis"}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openCreate(kindFilter === "equipment" ? "equipment" : "bike")}
              >
                Inventar hinzufügen
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[920px] [&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
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
                      key={`${row.original.kind}-${row.original.id}`}
                      className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
                      tabIndex={0}
                      onClick={() => openEdit(row.original)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEdit(row.original);
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
                      className="h-24 text-center text-muted-foreground"
                    >
                      {inventoryRows.length && filteredRowCount === 0
                        ? "Keine Inventareinträge entsprechen der Suche."
                        : kindFilter === "bike"
                          ? "Noch keine Bikes für diesen Standort erfasst."
                          : kindFilter === "equipment"
                            ? "Noch keine Ausrüstung für diesen Standort erfasst."
                            : "Noch keine Inventareinträge für diesen Standort erfasst."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              {filteredRowCount} {filteredRowCount === 1 ? "Eintrag" : "Einträge"}
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
      <InventoryDialog
        key={`${dialogKind}-${editingItem?.kind ?? "new"}-${editingItem?.id ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kind={dialogKind}
        item={editingItem}
        locations={locations}
        defaultLocation={locationFilter === "all" ? locations[0]?.key : (locationFilter as LocationOption["key"])}
        onSaved={handleSaved}
        onDelete={editingItem ? () => deleteItem(editingItem) : undefined}
      />
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  activeLabel = "Aktiv",
  inactiveLabel = "Pausiert",
}: {
  active: boolean;
  onClick: () => void;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          : "text-sm text-muted-foreground hover:underline"
      }
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

function InventoryDialog({
  open,
  onOpenChange,
  kind,
  item,
  locations,
  defaultLocation,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InventoryKind;
  item: EditingItem | null;
  locations: LocationOption[];
  defaultLocation: LocationOption["key"] | undefined;
  onSaved: (item: AdminInventoryBike | AdminInventoryEquipment, kind: InventoryKind, isNew: boolean) => void;
  onDelete?: () => Promise<void>;
}) {
  const [location, setLocation] = useState<LocationOption["key"]>(
    item?.location ?? defaultLocation ?? locations[0]?.key,
  );
  const [title, setTitle] = useState(item?.kind === "bike" ? item.title : "");
  const [nickname, setNickname] = useState(item?.kind === "bike" ? (item.nickname ?? "") : "");
  const [size, setSize] = useState(item?.kind === "bike" ? item.size : "");
  const [frameNumber, setFrameNumber] = useState(item?.kind === "bike" ? (item.frameNumber ?? "") : "");
  const [category, setCategory] = useState<EquipmentCategory>(item?.kind === "equipment" ? item.category : "pedal");
  const [labelDe, setLabelDe] = useState(item?.kind === "equipment" ? item.labelDe : "");
  const [labelEn, setLabelEn] = useState(item?.kind === "equipment" ? item.labelEn : "");
  const [price, setPrice] = useState(
    item?.kind === "bike" ? priceToInput(item.weekdayPriceCents) : item ? priceToInput(item.priceCents) : "",
  );
  const [weekendPrice, setWeekendPrice] = useState(item?.kind === "bike" ? priceToInput(item.weekendPriceCents) : "");
  const [availableQuantity, setAvailableQuantity] = useState(
    item?.kind === "equipment" ? String(item.availableQuantity) : "1",
  );
  const [quantityRelevant, setQuantityRelevant] = useState(item?.kind === "equipment" ? item.quantityRelevant : true);
  const [isVisibleOnLanding, setIsVisibleOnLanding] = useState(item?.kind === "bike" ? item.isVisibleOnLanding : true);
  const [isBookable, setIsBookable] = useState(item?.kind === "bike" ? item.isBookable : (item?.isAvailable ?? true));
  const [isAvailable, setIsAvailable] = useState(item?.kind === "equipment" ? item.isAvailable : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    const weekendPriceCents = Math.round(Number(weekendPrice.replace(",", ".")) * 100);
    if (
      !Number.isSafeInteger(priceCents) ||
      priceCents < 0 ||
      (kind === "bike" && (!Number.isSafeInteger(weekendPriceCents) || weekendPriceCents < 0))
    ) {
      setError("Bitte gib einen gültigen Preis ein.");
      setSaving(false);
      return;
    }
    const equipmentQuantity = Number(availableQuantity);
    if (
      kind === "equipment" &&
      (!Number.isSafeInteger(equipmentQuantity) || equipmentQuantity < 0 || equipmentQuantity > 10_000)
    ) {
      setError("Bitte gib eine gültige Anzahl zwischen 0 und 10.000 ein.");
      setSaving(false);
      return;
    }
    const isNew = !item;
    const payload =
      kind === "bike"
        ? {
            type: "bike" as const,
            ...(item ? { id: item.id } : {}),
            location,
            title: title.trim(),
            nickname: nickname.trim() || null,
            size: size.trim(),
            frameNumber: frameNumber.trim() || null,
            weekdayPriceCents: priceCents,
            weekendPriceCents,
            isVisibleOnLanding,
            isBookable,
          }
        : {
            type: "equipment" as const,
            ...(item ? { id: item.id } : {}),
            location,
            category,
            labelDe: labelDe.trim(),
            labelEn: labelEn.trim() || labelDe.trim(),
            priceCents,
            availableQuantity: equipmentQuantity,
            quantityRelevant,
            isAvailable,
          };
    if (kind === "bike" && (!title.trim() || !size.trim())) {
      setError("Bitte Typ/Modell und genau eine Größe angeben.");
      setSaving(false);
      return;
    }
    if (kind === "equipment" && !labelDe.trim()) {
      setError("Bitte die Art der Ausrüstung angeben.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/admin/inventory", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as {
      item?: { id: number; bikeKey?: string; equipmentKey?: string };
      message?: string;
    } | null;
    if (!response.ok || !result?.item) {
      setError(
        result?.message ??
          "Der Inventareintrag konnte nicht gespeichert werden. Prüfe Preis, Bestand, Typ/Modell und Größe.",
      );
      setSaving(false);
      return;
    }
    if (kind === "bike") {
      onSaved(
        {
          id: result.item.id,
          location,
          bikeKey: item?.kind === "bike" ? item.bikeKey : (result.item.bikeKey ?? title),
          title: title.trim(),
          nickname: nickname.trim() || null,
          frameNumber: frameNumber.trim() || null,
          weekdayPriceCents: priceCents,
          weekendPriceCents,
          isVisibleOnLanding,
          isBookable,
          size: size.trim(),
        },
        "bike",
        isNew,
      );
    } else {
      onSaved(
        {
          id: result.item.id,
          location,
          equipmentKey: item?.kind === "equipment" ? item.equipmentKey : (result.item.equipmentKey ?? labelDe),
          category,
          labelDe: labelDe.trim(),
          labelEn: labelEn.trim() || labelDe.trim(),
          priceCents,
          availableQuantity: equipmentQuantity,
          quantityRelevant,
          isAvailable,
        },
        "equipment",
        isNew,
      );
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>
              {item ? `${kind === "bike" ? "Bike" : "Inventar"} bearbeiten` : "Inventar hinzufügen"}
            </DialogTitle>
            <DialogDescription>
              {kind === "bike"
                ? "Pflege Modell, Größe und die Preise für Werktage und Wochenenden dieses Bikes."
                : "Pflege Kategorie, Art und Preis der Ausrüstung."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="inventory-location">Standort</FieldLabel>
              <Select
                items={locations.map((entry) => ({ value: entry.key, label: entry.label }))}
                value={location}
                onValueChange={(value) => value && setLocation(value as LocationOption["key"])}
              >
                <SelectTrigger id="inventory-location" className="w-full">
                  <SelectValue>{locations.find((entry) => entry.key === location)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((entry) => (
                    <SelectItem key={entry.key} value={entry.key}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {kind === "bike" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="inventory-title">Typ / Modell</FieldLabel>
                  <Input
                    id="inventory-title"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="z. B. Endurace CF SL 8"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inventory-nickname">Spitzname (optional)</FieldLabel>
                  <Input
                    id="inventory-nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="z. B. Blitz"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Wenn vorhanden, wird dieser Name bei der Fahrradauswahl angezeigt.
                  </p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="inventory-size">Größe</FieldLabel>
                  <Input
                    id="inventory-size"
                    required
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    placeholder="z. B. M"
                  />
                  <p className="text-xs text-muted-foreground">Pro Inventareintrag ist genau eine Größe erlaubt.</p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="inventory-frame-number">Rahmennummer (optional)</FieldLabel>
                  <Input
                    id="inventory-frame-number"
                    value={frameNumber}
                    onChange={(event) => setFrameNumber(event.target.value)}
                    placeholder="z. B. WTU123456789"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="inventory-category">Kategorie</FieldLabel>
                  <Select
                    items={equipmentCategories.map((value) => ({ value, label: equipmentCategoryLabels[value] }))}
                    value={category}
                    onValueChange={(value) => {
                      if (!value) return;
                      const nextCategory = value as EquipmentCategory;
                      setCategory(nextCategory);
                      if (!item) setQuantityRelevant(!defaultUncountedEquipmentCategories.has(nextCategory));
                    }}
                  >
                    <SelectTrigger id="inventory-category" className="w-full">
                      <SelectValue>{equipmentCategoryLabels[category]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentCategories.map((value) => (
                        <SelectItem key={value} value={value}>
                          {equipmentCategoryLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="inventory-label-de">Art / Bezeichnung</FieldLabel>
                    <Input
                      id="inventory-label-de"
                      required
                      value={labelDe}
                      onChange={(event) => setLabelDe(event.target.value)}
                      placeholder="z. B. SPD-SL"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inventory-label-en">Englische Bezeichnung</FieldLabel>
                    <Input
                      id="inventory-label-en"
                      value={labelEn}
                      onChange={(event) => setLabelEn(event.target.value)}
                      placeholder="z. B. SPD-SL"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="inventory-quantity">Anzahl im Bestand</FieldLabel>
                  <Input
                    id="inventory-quantity"
                    required
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    inputMode="numeric"
                    value={availableQuantity}
                    disabled={!quantityRelevant}
                    onChange={(event) => setAvailableQuantity(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {quantityRelevant
                      ? "Wie viele Exemplare dieser Ausrüstung am Standort vorhanden sind."
                      : "Die Anzahl begrenzt Buchungen nicht; dieses Zubehör wird pro Bike berücksichtigt."}
                  </p>
                </Field>
                <Field>
                  <label className="flex items-center gap-3 text-sm" htmlFor="inventory-quantity-relevant">
                    <input
                      id="inventory-quantity-relevant"
                      type="checkbox"
                      checked={quantityRelevant}
                      onChange={(event) => setQuantityRelevant(event.target.checked)}
                    />
                    Bestand zählen
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Ausschalten für Ausstattung, deren Anzahl vom jeweiligen Bike abhängt, zum Beispiel Flaschenhalter
                    oder Reparaturset.
                  </p>
                </Field>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="inventory-price">
                  {kind === "bike" ? "Preis Mo-Fr in Euro" : "Preis in Euro"}
                </FieldLabel>
                <Input
                  id="inventory-price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </Field>
              {kind === "bike" ? (
                <Field>
                  <FieldLabel htmlFor="inventory-weekend-price">Preis Sa-So in Euro</FieldLabel>
                  <Input
                    id="inventory-weekend-price"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={weekendPrice}
                    onChange={(event) => setWeekendPrice(event.target.value)}
                  />
                </Field>
              ) : null}
              {kind === "bike" ? (
                <>
                  <Field>
                    <FieldLabel>Landingpage</FieldLabel>
                    <label className="flex h-9 items-center gap-2 text-sm" htmlFor="inventory-visible-on-landing">
                      <input
                        id="inventory-visible-on-landing"
                        type="checkbox"
                        checked={isVisibleOnLanding}
                        onChange={(event) => setIsVisibleOnLanding(event.target.checked)}
                      />
                      Auf der Landingpage anzeigen
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Dieses Bike wird im öffentlichen Fahrradportfolio angezeigt.
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>Buchungen</FieldLabel>
                    <label className="flex h-9 items-center gap-2 text-sm" htmlFor="inventory-bookable">
                      <input
                        id="inventory-bookable"
                        type="checkbox"
                        checked={isBookable}
                        onChange={(event) => setIsBookable(event.target.checked)}
                      />
                      Für Buchungen auswählbar
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Sachbearbeiter können dieses konkrete Bike in Buchungen auswählen.
                    </p>
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="inventory-available">Buchungsstatus</FieldLabel>
                  <label className="flex h-9 items-center gap-2 text-sm" htmlFor="inventory-available">
                    <input
                      id="inventory-available"
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(event) => setIsAvailable(event.target.checked)}
                    />
                    Für Buchungen aktiv
                  </label>
                </Field>
              )}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter>
            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                disabled={saving}
                onClick={async () => {
                  await onDelete();
                }}
              >
                Löschen
              </Button>
            ) : null}
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
