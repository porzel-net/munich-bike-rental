"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

import { JournalExpenseDialog } from "@/components/journal-expense-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAccountLabel } from "@/lib/bookings/presentation";
import { formatJournalEntryKind } from "@/lib/financial/presentation";

export type JournalLine = {
  id: number;
  account: string;
  amountCents: number;
};

export type JournalEntry = {
  id: number;
  bookingId: number | null;
  orderNumber: string | null;
  customerName: string | null;
  kind: string;
  reason: string;
  reversesEntryId: number | null;
  dueAt: Date | null;
  occurredAt: Date;
  createdAt: Date;
  lines: JournalLine[];
  displayAmountCents: number;
  displayType: "revenue" | "expense" | "other";
};

type EntryFilter = "all" | "revenue" | "expense";

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const entryFilterItems = [
  { value: "all", label: "Alle Vorgänge" },
  { value: "revenue", label: "Erträge" },
  { value: "expense", label: "Aufwände" },
] as const;

function formatKind(kind: string) {
  return formatJournalEntryKind(kind);
}

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatDateRange(range: DateRange | undefined) {
  if (!range?.from) return "Alle Zeiträume";
  const from = format(range.from, "dd.MM.yyyy", { locale: de });
  return range.to ? `${from} – ${format(range.to, "dd.MM.yyyy", { locale: de })}` : from;
}

function previousWeekRange(today: Date): DateRange {
  const previousWeek = subWeeks(today, 1);
  return {
    from: startOfWeek(previousWeek, { weekStartsOn: 1 }),
    to: endOfWeek(previousWeek, { weekStartsOn: 1 }),
  };
}

function previousMonthRange(today: Date): DateRange {
  const previousMonth = subMonths(today, 1);
  return { from: startOfMonth(previousMonth), to: endOfMonth(previousMonth) };
}

function currentYearRange(today: Date): DateRange {
  return { from: startOfYear(today), to: endOfYear(today) };
}

function statusFor(entry: JournalEntry) {
  if (entry.displayType === "revenue") return "Ertrag";
  if (entry.displayType === "expense") return "Aufwand";
  return "Sonstige";
}

function formatOutstanding(amountCents: number) {
  if (amountCents > 0) return euroFormatter.format(amountCents / 100);
  if (amountCents < 0) return `Guthaben ${euroFormatter.format(Math.abs(amountCents) / 100)}`;
  return "Bezahlt";
}

function JournalEntryDetails({
  entry,
  open,
  onOpenChange,
}: {
  entry: JournalEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formatKind(entry.kind)}</DialogTitle>
          <DialogDescription>
            {entry.reason || "Keine Bezeichnung"} · {dateTimeFormatter.format(entry.occurredAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Quelle</p>
            {entry.bookingId ? (
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/admin/bookings/${entry.bookingId}`}
              >
                {entry.orderNumber ?? `Buchung #${entry.bookingId}`}
                {entry.customerName ? ` · ${entry.customerName}` : ""}
              </Link>
            ) : (
              <p className="font-medium">
                {entry.displayType === "expense" ? "Betriebsausgabe" : "Manuelle Journalbuchung"}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Betrag</p>
            <p
              className={`font-medium tabular-nums ${entry.displayAmountCents >= 0 ? "text-emerald-600" : "text-destructive"}`}
            >
              {entry.displayAmountCents >= 0 ? "+" : "−"}
              {euroFormatter.format(Math.abs(entry.displayAmountCents) / 100)}
            </p>
          </div>
          {entry.dueAt ? (
            <div>
              <p className="text-xs text-muted-foreground">Fällig</p>
              <p>{formatDate(entry.dueAt)}</p>
            </div>
          ) : null}
          {entry.reversesEntryId ? (
            <div>
              <p className="text-xs text-muted-foreground">Gegenbuchung zu</p>
              <p>Journalzeile #{entry.reversesEntryId}</p>
            </div>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Buchungszeilen</p>
          <div className="divide-y rounded-2xl border">
            {entry.lines.map((line) => (
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={line.id}>
                <span>{formatAccountLabel(line.account)}</span>
                <span className="font-medium tabular-nums">
                  {line.amountCents > 0 ? "+" : "−"}
                  {euroFormatter.format(Math.abs(line.amountCents) / 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Schließen</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountingJournalTable({ entries }: { entries: JournalEntry[] }) {
  const [journalRows, setJournalRows] = useState(entries);
  const [search, setSearch] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const dateFrom = dateRange?.from ? dateKey(dateRange.from) : "";
  const dateTo = dateRange?.to ? dateKey(dateRange.to) : "";
  const selectedEntryFilterLabel =
    entryFilterItems.find((item) => item.value === entryFilter)?.label ?? "Alle Vorgänge";

  function selectDateRange(nextRange: DateRange | undefined) {
    setDateRange(nextRange);
    if (nextRange?.from) setCalendarMonth(nextRange.from);
  }

  function applyDatePreset(nextRange: DateRange) {
    selectDateRange(nextRange);
    setDateFilterOpen(false);
  }

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    return journalRows
      .filter((entry) => {
        if (entryFilter !== "all" && entry.displayType !== entryFilter) return false;
        const entryDate = dateKey(entry.occurredAt);
        if (dateFrom && entryDate < dateFrom) return false;
        if (dateTo && entryDate > dateTo) return false;
        if (!query) return true;
        const searchable = [
          entry.orderNumber ?? "",
          entry.customerName ?? "",
          entry.reason,
          entry.kind,
          formatKind(entry.kind),
          statusFor(entry),
          entry.lines.map((line) => `${line.account} ${line.amountCents}`).join(" "),
          Math.abs(entry.displayAmountCents).toString(),
          (Math.abs(entry.displayAmountCents) / 100).toFixed(2),
        ];
        return searchable.join(" ").toLocaleLowerCase("de-DE").includes(query);
      })
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  }, [dateFrom, dateTo, entryFilter, journalRows, search]);

  const outstandingByBooking = useMemo(() => {
    const amounts = new Map<number, number>();
    for (const entry of journalRows) {
      if (entry.bookingId === null) continue;
      const receivableCents = entry.lines
        .filter((line) => line.account === "accounts_receivable")
        .reduce((sum, line) => sum + line.amountCents, 0);
      amounts.set(entry.bookingId, (amounts.get(entry.bookingId) ?? 0) + receivableCents);
    }
    return amounts;
  }, [journalRows]);

  const outstandingCents = useMemo(() => {
    const bookingIds = new Set(filteredEntries.flatMap((entry) => (entry.bookingId ? [entry.bookingId] : [])));
    return [...bookingIds].reduce((sum, bookingId) => sum + Math.max(outstandingByBooking.get(bookingId) ?? 0, 0), 0);
  }, [filteredEntries, outstandingByBooking]);

  const revenueCents = filteredEntries
    .filter((entry) => entry.displayType === "revenue")
    .reduce((sum, entry) => sum + Math.abs(entry.displayAmountCents), 0);
  const expenseCents = filteredEntries
    .filter((entry) => entry.displayType === "expense")
    .reduce((sum, entry) => sum + Math.abs(entry.displayAmountCents), 0);
  const balanceCents = revenueCents - expenseCents;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Finanzjournal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unveränderliche Erträge und Aufwände mit nachvollziehbarer Quelle.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Finanzjournal durchsuchen..."
              aria-label="Finanzjournal durchsuchen"
            />
          </InputGroup>
          <Select
            items={entryFilterItems}
            value={entryFilter}
            onValueChange={(value) => value && setEntryFilter(value as EntryFilter)}
          >
            <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-36 sm:flex-none" aria-label="Journaltyp filtern">
              <SelectValue className="text-sm font-normal">{selectedEntryFilterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {entryFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
            <PopoverTrigger
              render={<Button type="button" variant="outline" size="sm" className="max-w-full" />}
              aria-label="Zeitraum auswählen"
            >
              <CalendarDaysIcon />
              <span className="max-w-48 truncate">{formatDateRange(dateRange)}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <div className="flex flex-col">
                <Calendar
                  mode="range"
                  locale={de}
                  selected={dateRange}
                  onSelect={selectDateRange}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  numberOfMonths={1}
                />
                <div className="flex flex-wrap items-center gap-1 border-t p-2">
                  <p className="sr-only">Schnellauswahl</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => applyDatePreset(previousWeekRange(new Date()))}
                  >
                    Letzte Woche
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => applyDatePreset(previousMonthRange(new Date()))}
                  >
                    Letzter Monat
                  </Button>
                  <div aria-hidden="true" className="basis-full" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => applyDatePreset(currentYearRange(new Date()))}
                  >
                    Kalenderjahr
                  </Button>
                  {dateRange ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start text-muted-foreground"
                      onClick={() => {
                        selectDateRange(undefined);
                        setDateFilterOpen(false);
                      }}
                    >
                      Zurücksetzen
                    </Button>
                  ) : null}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" size="sm" onClick={() => setCreateExpenseOpen(true)}>
            <PlusIcon /> Aufwand hinzufügen
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl bg-card">
        <Table className="text-sm">
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Quelle</TableHead>
              <TableHead>Vorgang / Beschreibung</TableHead>
              <TableHead>Zeitpunkt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Noch offen</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Keine Journalbuchungen gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedEntry(entry);
                    }
                  }}
                >
                  <TableCell>
                    <div
                      className={`flex size-8 items-center justify-center rounded-md ${entry.displayAmountCents >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                    >
                      {entry.displayAmountCents > 0 ? (
                        <ArrowDownLeftIcon className="size-4" />
                      ) : entry.displayAmountCents < 0 ? (
                        <ArrowUpRightIcon className="size-4" />
                      ) : (
                        <ReceiptTextIcon className="size-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      {entry.bookingId ? (
                        <Link
                          className="font-medium underline-offset-4 hover:underline"
                          href={`/admin/bookings/${entry.bookingId}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {entry.orderNumber ?? `Buchung #${entry.bookingId}`}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {entry.displayType === "expense" ? "Betriebsausgabe" : "Manuell / System"}
                        </span>
                      )}
                      {entry.customerName ? (
                        <span className="text-xs text-muted-foreground">{entry.customerName}</span>
                      ) : entry.displayType !== "expense" ? (
                        <span className="text-xs text-muted-foreground">Keine Auftragsreferenz</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{entry.reason || formatKind(entry.kind)}</span>
                      <span className="text-xs text-muted-foreground">{formatKind(entry.kind)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {dateTimeFormatter.format(entry.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        entry.displayType === "revenue"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : entry.displayType === "expense"
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                            : undefined
                      }
                    >
                      {statusFor(entry)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${entry.bookingId && (outstandingByBooking.get(entry.bookingId) ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {entry.bookingId ? formatOutstanding(outstandingByBooking.get(entry.bookingId) ?? 0) : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${entry.displayAmountCents > 0 ? "text-emerald-600" : entry.displayAmountCents < 0 ? "text-destructive" : ""}`}
                  >
                    {entry.displayAmountCents >= 0 ? "+" : "−"}
                    {euroFormatter.format(Math.abs(entry.displayAmountCents) / 100)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Journalaktionen"
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedEntry(entry)}>Details anzeigen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="border-t hover:bg-transparent">
              <TableCell colSpan={6} />
              <TableCell className="text-right font-semibold">Erträge</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                +{euroFormatter.format(revenueCents / 100)}
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} />
              <TableCell className="text-right font-semibold">Aufwände</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                −{euroFormatter.format(expenseCents / 100)}
              </TableCell>
            </TableRow>
            <TableRow className="font-medium hover:bg-transparent">
              <TableCell colSpan={6} />
              <TableCell className="text-right font-semibold">Saldo</TableCell>
              <TableCell
                className={`text-right font-semibold tabular-nums ${balanceCents >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {balanceCents >= 0 ? "+" : "−"}
                {euroFormatter.format(Math.abs(balanceCents) / 100)}
              </TableCell>
            </TableRow>
            <TableRow className="font-medium hover:bg-transparent">
              <TableCell colSpan={6} />
              <TableCell className="text-right font-semibold">Offene Forderungen</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-destructive">
                {euroFormatter.format(outstandingCents / 100)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <JournalExpenseDialog
        open={createExpenseOpen}
        onOpenChange={setCreateExpenseOpen}
        onSaved={(entry) => setJournalRows((current) => [entry, ...current])}
      />
      {selectedEntry ? (
        <JournalEntryDetails entry={selectedEntry} open onOpenChange={(open) => !open && setSelectedEntry(null)} />
      ) : null}
    </div>
  );
}
