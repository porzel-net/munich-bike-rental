"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CheckIcon,
  ClipboardIcon,
  KeyRoundIcon,
  SmartphoneIcon,
  XCircleIcon,
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

import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BUSINESS_TIME_ZONE } from "@/lib/datetime";

const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));

type ContactBooking = {
  id: number;
  orderNumber: string;
  location: string;
  status: string;
  periodFrom: string;
  periodTo: string;
  updatedAt: string;
};

type Contact = {
  key: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  locations: string[];
  latestUpdatedAt: string;
  bookings: ContactBooking[];
};

export type CarddavAccountState = {
  server: string | null;
  account: {
    username: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  } | null;
};

type Credentials = {
  server: string;
  username: string;
  password: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE }).format(
    new Date(value),
  );
}

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
}

function SortableContactHeader({ column, children }: { column: Column<Contact, unknown>; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

const contactGlobalFilter: FilterFn<Contact> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;
  return [
    row.original.name,
    row.original.email,
    row.original.phone,
    ...row.original.bookings.map((booking) => booking.orderNumber),
  ]
    .filter(Boolean)
    .some((item) => item!.toLocaleLowerCase("de-DE").includes(search));
};

function getContactColumns(): ColumnDef<Contact>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableContactHeader column={column}>Name</SortableContactHeader>,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
              {contactInitials(row.original.name)}
            </span>
          </div>
          <span className="truncate font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortableContactHeader column={column}>E-Mail</SortableContactHeader>,
      cell: ({ row }) => (
        <a
          className="block max-w-64 truncate text-sm text-muted-foreground hover:text-foreground"
          href={`mailto:${row.original.email}`}
          title={row.original.email}
        >
          {row.original.email}
        </a>
      ),
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <SortableContactHeader column={column}>Telefonnummer</SortableContactHeader>,
      cell: ({ row }) => (
        <a className="text-sm text-muted-foreground hover:text-foreground" href={`tel:${row.original.phone}`}>
          {row.original.phone}
        </a>
      ),
    },
    {
      id: "bookings",
      accessorFn: (row) => row.bookings.length,
      header: ({ column }) => <SortableContactHeader column={column}>Aufträge</SortableContactHeader>,
      cell: ({ row }) => (
        <div className="flex min-w-64 flex-wrap gap-2">
          {row.original.bookings.length ? (
            row.original.bookings.map((booking) => (
              <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
                <Badge variant="outline" className="hover:bg-muted">
                  {booking.orderNumber}
                </Badge>
              </Link>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Keine Aufträge</span>
          )}
        </div>
      ),
    },
  ];
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label={`${label} kopieren`}>
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </Button>
  );
}

export function AdminContactsPage({ contacts, carddav }: { contacts: Contact[]; carddav: CarddavAccountState }) {
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState<"credentials" | "sync" | "revoke" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [account, setAccount] = useState(carddav.account);

  const columns = useMemo(() => getContactColumns(), []);
  // TanStack Table exposes an intentionally mutable table instance; React Compiler cannot memoize it safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: contacts,
    columns,
    state: { globalFilter: query, sorting, columnVisibility, pagination },
    onGlobalFilterChange: setQuery,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: contactGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visibleRows = table.getRowModel().rows;
  const filteredContactCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  function openCarddavDialog() {
    setMessage(null);
    setCredentials(null);
    setDialogOpen(true);
  }

  async function rotateCredentials() {
    setBusy("credentials");
    setMessage(null);
    const response = await fetch("/api/admin/carddav", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      credentials?: Credentials;
      message?: string;
    };
    setBusy(null);
    if (!response.ok || !body.credentials) {
      setMessage(body.message ?? "Der CardDAV-Zugang konnte nicht eingerichtet werden.");
      return;
    }
    setCredentials(body.credentials);
    setAccount((current) => ({
      username: body.credentials!.username,
      enabled: true,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: current?.lastSyncedAt ?? null,
      lastSyncError: null,
    }));
  }

  async function syncContacts() {
    setBusy("sync");
    setMessage(null);
    const response = await fetch("/api/admin/carddav/sync", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { synced?: number; message?: string; syncedAt?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(body.message ?? "Die Kontakte konnten nicht synchronisiert werden.");
      return;
    }
    setAccount((current) =>
      current ? { ...current, lastSyncedAt: body.syncedAt ?? new Date().toISOString(), lastSyncError: null } : current,
    );
    setMessage(`${body.synced ?? 0} Kontakte wurden an CardDAV übertragen.`);
  }

  async function revokeCredentials() {
    if (!window.confirm("CardDAV-Zugang wirklich widerrufen? Das iPhone kann danach nicht mehr synchronisieren."))
      return;
    setBusy("revoke");
    const response = await fetch("/api/admin/carddav", { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(
        body.message ??
          "Der CardDAV-Zugang konnte nicht widerrufen werden. Prüfe deine Berechtigung und versuche es erneut.",
      );
      return;
    }
    setAccount((current) => (current ? { ...current, enabled: false } : current));
    setCredentials(null);
    setMessage(
      "Der CardDAV-Zugang wurde widerrufen. Bereits synchronisierte Kontakte bleiben auf den Geräten, bis der Account entfernt wird.",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Kontakte" description="Kundendaten und zugehörige Buchungen zentral verwalten." />

      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
              placeholder="Kontakte suchen …"
              aria-label="Kontakte durchsuchen"
              className="w-full sm:max-w-sm"
            />
            <div className="flex w-full items-center justify-end gap-2 md:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                  Spalten
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id === "bookings"
                          ? "Aufträge"
                          : column.id === "email"
                            ? "E-Mail"
                            : column.id === "phone"
                              ? "Telefonnummer"
                              : "Name"}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" variant="outline" size="sm" onClick={openCarddavDialog}>
                iPhone verbinden
              </Button>
              {account?.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void syncContacts()}
                  disabled={busy !== null}
                >
                  Kontakte synchronisieren
                </Button>
              ) : null}
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
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center">
                      {contacts.length && filteredContactCount === 0
                        ? "Keine Kontakte entsprechen dem Suchbegriff."
                        : "Keine Kontakte gefunden."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              {filteredContactCount} {filteredContactCount === 1 ? "Kontakt" : "Kontakte"}
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

      {message ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setCredentials(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SmartphoneIcon className="size-5" /> iPhone mit Kontakten verbinden
            </DialogTitle>
            <DialogDescription>
              CardDAV synchronisiert den sichtbaren Kontaktbestand im Hintergrund auf dein iPhone. Das CardDAV-Passwort
              ist unabhängig von deinem Login und wird nur bei der Erzeugung angezeigt.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Erzeuge unten deine persönlichen CardDAV-Zugangsdaten.</li>
              <li>Öffne auf dem iPhone Einstellungen → Apps → Kontakte → Kontakteaccounts.</li>
              <li>Wähle Account hinzufügen → Anderen Account hinzufügen → CardDAV-Account hinzufügen.</li>
              <li>Trage Server, Benutzername und Passwort aus diesem Dialog ein.</li>
            </ol>

            {!carddav.server ? (
              <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
                Der CardDAV-Server ist noch nicht für diese Umgebung konfiguriert.
              </div>
            ) : null}

            {credentials ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-medium">Passwort jetzt sicher speichern</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nach dem Schließen kann es nicht erneut angezeigt werden. Bei Verlust erzeugst du ein neues
                      Passwort.
                    </p>
                  </div>
                </div>
                <CredentialRow label="Server" value={credentials.server} />
                <CredentialRow label="Benutzername" value={credentials.username} />
                <CredentialRow label="Passwort" value={credentials.password} secret />
              </div>
            ) : account?.enabled && carddav.server ? (
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-medium">CardDAV ist eingerichtet.</p>
                <p className="mt-1 text-muted-foreground">
                  Das bestehende Passwort wird nicht angezeigt. Erzeuge nur bei Bedarf ein neues Passwort; dadurch wird
                  das alte sofort ungültig.
                </p>
              </div>
            ) : null}

            {account?.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground">
                Letzte Synchronisierung: {formatDate(account.lastSyncedAt)}
              </p>
            ) : null}
            {account?.lastSyncError ? (
              <p className="text-sm text-destructive">Letzter Synchronisierungsfehler: {account.lastSyncError}</p>
            ) : null}
          </div>

          <DialogFooter>
            {account?.enabled ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void revokeCredentials()}
                disabled={busy !== null}
              >
                <XCircleIcon />
                Zugang widerrufen
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => void rotateCredentials()}
              disabled={busy !== null || !carddav.server}
            >
              <KeyRoundIcon />
              {account?.enabled ? "Neues Passwort erzeugen" : "Zugang einrichten"}
            </Button>
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Fertig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <code className="min-w-0 break-all rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border/60">
        {secret ? value : value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}
