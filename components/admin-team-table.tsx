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
  MoreHorizontal,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const pageSizeItems = [10, 20, 30, 50].map((pageSize) => ({ value: `${pageSize}`, label: `${pageSize}` }));

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "standortuser";
  locationKey: string | null;
};

type AdminTeamTableProps = {
  users: TeamUser[];
  currentUserId: string;
  locationLabels: Record<string, string>;
};

function getInitials(name: string) {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase();
  return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
}

function SortableTeamHeader({ column, children }: { column: Column<TeamUser, unknown>; children: React.ReactNode }) {
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

const teamGlobalFilter: FilterFn<TeamUser> = (row, _columnId, value) => {
  const search = String(value).trim().toLocaleLowerCase("de-DE");
  if (!search) return true;
  const user = row.original;
  return [user.name, user.email, user.role, user.locationKey]
    .filter(Boolean)
    .some((item) => item!.toLocaleLowerCase("de-DE").includes(search));
};

function getTeamColumns(
  locationLabels: Record<string, string>,
  currentUserId: string,
  onEdit: (user: TeamUser) => void,
  onDelete: (user: TeamUser) => void,
): ColumnDef<TeamUser>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableTeamHeader column={column}>Nutzer</SortableTeamHeader>,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <span className="text-sm font-semibold uppercase">{getInitials(row.original.name)}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="truncate text-sm text-muted-foreground">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => <SortableTeamHeader column={column}>Rolle</SortableTeamHeader>,
      cell: ({ row }) => (row.original.role === "admin" ? "Admin" : "Standortuser"),
    },
    {
      id: "location",
      accessorFn: (row) =>
        row.role === "admin" ? "Alle Standorte" : (locationLabels[row.locationKey ?? ""] ?? "Kein Standort"),
      header: ({ column }) => <SortableTeamHeader column={column}>Standort</SortableTeamHeader>,
      cell: ({ row }) =>
        row.original.role === "admin"
          ? "Alle Standorte"
          : (row.original.locationKey && locationLabels[row.original.locationKey]) || "Kein Standort",
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">Aktionen</span>,
      cell: ({ row }) => {
        const isCurrentUser = row.original.id === currentUserId;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal />
              <span className="sr-only">Aktionen für {row.original.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)} disabled={isCurrentUser}>
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)} disabled={isCurrentUser}>
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export function AdminTeamTable({ users: initialUsers, currentUserId, locationLabels }: AdminTeamTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [role, setRole] = useState<"admin" | "standortuser">("standortuser");
  const [locationKey, setLocationKey] = useState("munich");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "standortuser">("standortuser");
  const [inviteLocationKey, setInviteLocationKey] = useState("munich");
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  function openEdit(user: TeamUser) {
    setEditingUser(user);
    setRole(user.role);
    setLocationKey(user.locationKey ?? "munich");
    setMessage(null);
  }

  async function saveUser() {
    if (!editingUser) return;
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUser.id,
        role,
        locationKey: role === "standortuser" ? locationKey : null,
      }),
    });
    setIsSaving(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(
        result.message ??
          "Die Rolle oder Standortzuordnung konnte nicht gespeichert werden. Prüfe die Auswahl und versuche es erneut.",
      );
      return;
    }
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === editingUser.id
          ? { ...user, role, locationKey: role === "standortuser" ? locationKey : null }
          : user,
      ),
    );
    setEditingUser(null);
  }

  async function deleteUser(user: TeamUser) {
    if (!window.confirm(`Soll ${user.name} wirklich gelöscht werden?`)) return;
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(
        result.message ??
          "Der Nutzer konnte nicht gelöscht werden. Prüfe, ob du den letzten Administrator ausgewählt hast.",
      );
      return;
    }
    setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
  }

  async function createInvitation() {
    setIsInviting(true);
    setMessage(null);
    setInvitationLink(null);
    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName,
        role: inviteRole,
        locationKey: inviteRole === "standortuser" ? inviteLocationKey : null,
      }),
    });
    setIsInviting(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(result.message ?? "Der Einladungslink konnte nicht erzeugt werden. Prüfe Name, Rolle und Standort.");
      return;
    }
    const result = (await response.json()) as { invitation?: { link: string } };
    setInvitationLink(result.invitation?.link ?? null);
  }

  function closeInviteDialog(open: boolean) {
    setIsInviteOpen(open);
    if (!open) {
      setInviteName("");
      setInvitationLink(null);
      setMessage(null);
    }
  }

  const columns = useMemo(
    () => getTeamColumns(locationLabels, currentUserId, openEdit, (user) => void deleteUser(user)),
    [currentUserId, locationLabels],
  );
  // TanStack Table exposes an intentionally mutable table instance; React Compiler cannot memoize it safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter, sorting, columnVisibility, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: teamGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visibleRows = table.getRowModel().rows;
  const filteredUserCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title="Team" description="Nutzer und Berechtigungen verwalten." />
        {message ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1">
                <Input
                  value={globalFilter}
                  onChange={(event) => {
                    setGlobalFilter(event.target.value);
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                  placeholder="Team durchsuchen …"
                  aria-label="Team durchsuchen"
                  className="w-full sm:max-w-sm"
                />
              </div>
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
                          {column.id === "name" ? "Nutzer" : column.id === "role" ? "Rolle" : "Standort"}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(true)}>
                  Einladungslink erstellen
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table className="min-w-[640px] text-sm [&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
                <TableHeader className="bg-muted/40">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={header.column.id === "actions" ? "w-12" : undefined}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                          <TableCell key={cell.id} className={cell.column.id === "actions" ? "w-12" : undefined}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center">
                        {users.length && filteredUserCount === 0
                          ? "Keine Teammitglieder entsprechen dem Suchbegriff."
                          : "Keine Teammitglieder gefunden."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                {filteredUserCount} {filteredUserCount === 1 ? "Teammitglied" : "Teammitglieder"}
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
      </div>

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md p-0">
          <div className="rounded-4xl bg-card p-6 shadow-none ring-0">
            <div className="mb-6">
              <DialogHeader>
                <DialogTitle>Nutzer bearbeiten</DialogTitle>
                <DialogDescription>
                  {editingUser?.name} · {editingUser?.email}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="team-edit-role">Rolle</FieldLabel>
                  <Select
                    items={[
                      { value: "admin", label: "Admin" },
                      { value: "standortuser", label: "Standortuser" },
                    ]}
                    value={role}
                    onValueChange={(value) => value && setRole(value as typeof role)}
                  >
                    <SelectTrigger id="team-edit-role" className="w-full">
                      <SelectValue>{role === "admin" ? "Admin" : "Standortuser"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="standortuser">Standortuser</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {role === "standortuser" ? (
                  <Field>
                    <FieldLabel htmlFor="team-edit-location">Standort</FieldLabel>
                    <Select
                      items={Object.entries(locationLabels).map(([value, label]) => ({ value, label }))}
                      value={locationKey}
                      onValueChange={(value) => value && setLocationKey(value)}
                    >
                      <SelectTrigger id="team-edit-location" className="w-full">
                        <SelectValue>{locationLabels[locationKey]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(locationLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Abbrechen
                </Button>
                <Button onClick={() => void saveUser()} disabled={isSaving}>
                  {isSaving ? "Speichern …" : "Speichern"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteOpen} onOpenChange={closeInviteDialog}>
        <DialogContent className="max-w-md p-0">
          <div className="rounded-4xl bg-card p-6 shadow-none ring-0">
            <div className="mb-6">
              <DialogHeader>
                <DialogTitle>Einladungslink erstellen</DialogTitle>
                <DialogDescription>Lege fest, wer dem Team beitreten darf.</DialogDescription>
              </DialogHeader>
            </div>
            <div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="team-invite-name">Name</FieldLabel>
                  <Input
                    id="team-invite-name"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Vorname Nachname"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team-invite-role">Rolle</FieldLabel>
                  <Select
                    items={[
                      { value: "admin", label: "Admin" },
                      { value: "standortuser", label: "Standortuser" },
                    ]}
                    value={inviteRole}
                    onValueChange={(value) => value && setInviteRole(value as typeof inviteRole)}
                  >
                    <SelectTrigger id="team-invite-role" className="w-full">
                      <SelectValue>{inviteRole === "admin" ? "Admin" : "Standortuser"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="standortuser">Standortuser</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {inviteRole === "standortuser" ? (
                  <Field>
                    <FieldLabel htmlFor="team-invite-location">Standort</FieldLabel>
                    <Select
                      items={Object.entries(locationLabels).map(([value, label]) => ({ value, label }))}
                      value={inviteLocationKey}
                      onValueChange={(value) => value && setInviteLocationKey(value)}
                    >
                      <SelectTrigger id="team-invite-location" className="w-full">
                        <SelectValue>{locationLabels[inviteLocationKey]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(locationLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {invitationLink ? (
                  <Field>
                    <FieldLabel htmlFor="team-invitation-link">Einladungslink</FieldLabel>
                    <div className="flex gap-2">
                      <Input id="team-invitation-link" className="min-w-0" value={invitationLink} readOnly />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void navigator.clipboard.writeText(invitationLink)}
                      >
                        Kopieren
                      </Button>
                    </div>
                  </Field>
                ) : null}
              </FieldGroup>
              {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => closeInviteDialog(false)}>
                  Schließen
                </Button>
                <Button onClick={() => void createInvitation()} disabled={isInviting || inviteName.trim().length < 2}>
                  {isInviting ? "Link wird erzeugt …" : "Link erstellen"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
