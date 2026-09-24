"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CheckIcon,
  CircleAlertIcon,
  RefreshCwIcon,
  ArrowUpDownIcon,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Column,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { MailOutboxFilter } from "@/components/mail-outbox-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import { MAX_MAIL_ATTEMPTS } from "@/lib/bookings/outbox-constants";

export type MailOutboxStatus = "queued" | "leased" | "sent" | "failed" | "cancelled";

export type MailOutboxRow = {
  id: number;
  bookingId: number;
  orderNumber: string;
  customerName: string;
  recipient: string;
  subject: string;
  kind: string;
  status: MailOutboxStatus;
  attempts: number;
  nextAttemptAt: string;
  sentAt: string | null;
  createdAt: string;
  plainText: string;
  lastError: string | null;
  sentMailboxError: string | null;
  acknowledgedAt: string | null;
};

const pageSizeItems = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

const kindLabels: Record<string, string> = {
  new_inquiry: "Neue Anfrage",
  inquiry_received: "Anfrage-Eingang",
  offer: "Angebot",
  alternative_offer: "Alternativangebot",
  booking_confirmed: "Buchungsbestätigung",
  booking_cancelled: "Stornierung",
  booking_rejected: "Absage",
  booking_information_changed: "Buchungsänderung",
  feedback_request: "Feedback-Anfrage",
  cancelled: "Stornierung",
  rejected: "Absage",
};

function kindLabel(kind: string) {
  return kindLabels[kind] ?? kind.replaceAll("_", " ");
}

function statusView(status: MailOutboxStatus) {
  switch (status) {
    case "queued":
      return { label: "In Warteschlange", variant: "outline" as const };
    case "leased":
      return { label: "Wird versendet", variant: "default" as const };
    case "sent":
      return { label: "Versendet", variant: "success" as const };
    case "failed":
      return { label: "Fehlgeschlagen", variant: "destructive" as const };
    case "cancelled":
      return { label: "Abgebrochen", variant: "secondary" as const };
  }
}

function SortableHeader({ column, children }: { column: Column<MailOutboxRow, unknown>; children: React.ReactNode }) {
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

export function MailOutboxTable({ rows, search, status }: { rows: MailOutboxRow[]; search: string; status: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<MailOutboxRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [cancelCandidate, setCancelCandidate] = useState<MailOutboxRow | null>(null);

  const retry = useCallback(
    async (row: MailOutboxRow) => {
      setRetryingId(row.id);
      try {
        const response = await fetch(`/api/admin/mail-outbox/${row.id}/retry`, { method: "POST" });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "Die Mail konnte nicht erneut eingereiht werden.");
        toast.success("Mail wurde erneut in die Warteschlange eingereiht.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Die Mail konnte nicht erneut eingereiht werden.");
      } finally {
        setRetryingId(null);
      }
    },
    [router],
  );

  const cancelMail = useCallback(
    async (row: MailOutboxRow) => {
      setRetryingId(row.id);
      try {
        const response = await fetch(`/api/admin/mail-outbox/${row.id}/cancel`, { method: "POST" });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "Die Mail konnte nicht abgebrochen werden.");
        toast.success("E-Mail-Versand wurde abgebrochen.");
        setCancelCandidate(null);
        setSelected(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Die Mail konnte nicht abgebrochen werden.");
      } finally {
        setRetryingId(null);
      }
    },
    [router],
  );

  const acknowledgeMail = useCallback(
    async (row: MailOutboxRow) => {
      setRetryingId(row.id);
      try {
        const response = await fetch(`/api/admin/mail-outbox/${row.id}/acknowledge`, { method: "POST" });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "Der E-Mail-Versuch konnte nicht bestätigt werden.");
        toast.success("E-Mail-Versuch als gesehen markiert.");
        setSelected(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Der E-Mail-Versuch konnte nicht bestätigt werden.");
      } finally {
        setRetryingId(null);
      }
    },
    [router],
  );

  const columns = useMemo<ColumnDef<MailOutboxRow>[]>(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column}>Eingereiht</SortableHeader>,
        cell: ({ row }) => <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span>,
      },
      {
        id: "mail",
        accessorFn: (row) => `${row.subject} ${row.recipient} ${row.orderNumber} ${row.customerName}`,
        header: "Mail",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-[28rem] min-w-64">
            <div className="truncate font-medium" title={row.original.subject}>
              {row.original.subject}
            </div>
            <div className="truncate text-xs text-muted-foreground" title={row.original.recipient}>
              {row.original.recipient}
            </div>
          </div>
        ),
      },
      {
        id: "booking",
        accessorFn: (row) => `${row.orderNumber} ${row.customerName}`,
        header: ({ column }) => <SortableHeader column={column}>Buchung</SortableHeader>,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.orderNumber}</div>
            <div className="text-xs text-muted-foreground">{row.original.customerName}</div>
          </div>
        ),
      },
      {
        id: "kind",
        accessorKey: "kind",
        header: ({ column }) => <SortableHeader column={column}>Typ</SortableHeader>,
        cell: ({ row }) => kindLabel(row.original.kind),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => {
          const view = statusView(row.original.status);
          return (
            <div className="flex items-center gap-2">
              <Badge variant={view.variant}>{view.label}</Badge>
              {row.original.sentMailboxError ? (
                <CircleAlertIcon className="size-4 text-amber-600" aria-label="Sent-Kopie fehlgeschlagen" />
              ) : null}
            </div>
          );
        },
      },
      {
        id: "attempts",
        accessorKey: "attempts",
        header: ({ column }) => <SortableHeader column={column}>Versuche</SortableHeader>,
        cell: ({ row }) => <span className="tabular-nums">{row.original.attempts}</span>,
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "failed" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={retryingId === row.original.id}
              onClick={(event) => {
                event.stopPropagation();
                void retry(row.original);
              }}
            >
              <RefreshCwIcon className={retryingId === row.original.id ? "animate-spin" : undefined} />
              Erneut versuchen
            </Button>
          ) : null,
      },
    ],
    [retry, retryingId],
  );

  // TanStack Table exposes an intentionally mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const visibleRows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <>
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <MailOutboxFilter search={search} status={status} />
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
                      {column.id === "createdAt"
                        ? "Eingereiht"
                        : column.id === "booking"
                          ? "Buchung"
                          : column.id === "kind"
                            ? "Typ"
                            : column.id === "status"
                              ? "Status"
                              : "Versuche"}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <Table className="text-sm [&_td]:px-6 [&_td]:py-4 [&_th]:px-6 [&_th]:py-4">
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                      className="cursor-pointer hover:bg-muted/50"
                      tabIndex={0}
                      onClick={() => setSelected(row.original)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(row.original);
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
                      Keine Mails für die aktuellen Filter vorhanden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              {rows.length} {rows.length === 1 ? "Mail" : "Mails"}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Zeilen pro Seite</span>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                  items={pageSizeItems}
                >
                  <SelectTrigger size="sm" className="w-20" aria-label="Zeilen pro Seite">
                    <SelectValue />
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

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
            <DialogDescription>
              {selected ? `${kindLabel(selected.kind)} · ${selected.orderNumber} · ${selected.recipient}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="grid gap-5 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={statusView(selected.status).variant}>{statusView(selected.status).label}</Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Eingereiht</div>
                  <div>{formatDateTime(selected.createdAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Versuche</div>
                  <div>{selected.attempts}</div>
                </div>
              </div>
              {selected.sentAt ? (
                <div>
                  <div className="text-muted-foreground">Versendet</div>
                  <div>{formatDateTime(selected.sentAt)}</div>
                </div>
              ) : null}
              {selected.status !== "sent" && selected.status !== "cancelled" ? (
                <div>
                  <div className="text-muted-foreground">Nächster Versandversuch</div>
                  <div>{formatDateTime(selected.nextAttemptAt)}</div>
                </div>
              ) : null}
              {selected.lastError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="font-medium text-destructive">Versandfehler</div>
                  <div className="mt-1 whitespace-pre-wrap text-destructive/90">{selected.lastError}</div>
                </div>
              ) : null}
              {selected.sentMailboxError ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="font-medium text-amber-700 dark:text-amber-400">Sent-Kopie nicht abgelegt</div>
                  <div className="mt-1">
                    Die Mail wurde versendet, konnte aber nicht zusätzlich im Gesendet-Ordner archiviert werden.
                  </div>
                </div>
              ) : null}
              <div className="max-h-80 overflow-auto rounded-lg border bg-muted/20 p-4">
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">{selected.plainText}</pre>
              </div>
              {selected.acknowledgedAt ? (
                <div className="text-right text-xs text-muted-foreground">
                  Als gesehen markiert am {formatDateTime(selected.acknowledgedAt)}
                </div>
              ) : null}
              {selected.attempts >= MAX_MAIL_ATTEMPTS &&
              (selected.status === "failed" || selected.status === "cancelled") ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={retryingId === selected.id || Boolean(selected.acknowledgedAt)}
                    onClick={() => void acknowledgeMail(selected)}
                  >
                    <CheckIcon />
                    {selected.acknowledgedAt ? "Gesehen" : "Als gesehen markieren"}
                  </Button>
                </div>
              ) : null}
              {selected.status === "queued" || selected.status === "failed" ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={retryingId === selected.id}
                    onClick={() => setCancelCandidate(selected)}
                  >
                    Versand abbrechen
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelCandidate)} onOpenChange={(open) => !open && setCancelCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail-Versand abbrechen?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelCandidate
                ? `Die Mail „${cancelCandidate.subject}“ wird nicht weiter versendet. Dieser Vorgang kann nicht rückgängig gemacht werden.`
                : "Die Mail wird nicht weiter versendet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!cancelCandidate || retryingId === cancelCandidate.id}
              onClick={(event) => {
                event.preventDefault();
                if (cancelCandidate) void cancelMail(cancelCandidate);
              }}
            >
              Versand abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
