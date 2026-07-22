"use client";

import { useMemo, useState } from "react";
import { CalendarPlusIcon, PlusIcon, SearchIcon } from "lucide-react";

import { AdminBookingMailActions, StatusBadge } from "@/components/admin-booking-mail-actions";
import { AdminBookingStatusActions } from "@/components/admin-booking-status-actions";
import { AdminBookingDialog } from "@/components/admin-booking-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rentalLocationLabels, type RentalLocation } from "@/lib/inquiries/catalog";

export type AdminBooking = {
  id: number;
  orderNumber: string;
  name: string;
  location: RentalLocation;
  periodFrom: string;
  periodTo: string;
  totalPriceCents: number;
  paidAmountCents: number;
  status: "rejected" | "pending" | "confirmed" | "executed" | "cancelled" | "unanswered";
  source: "automatic" | "manual";
  bikes: string[];
  email: string;
  phone: string;
  pickupTime: string;
  dropoffTime: string;
  message: string;
  bikeTitle: string | null;
  bikeDetails: AdminBookingBike[];
  mailActions: {
    confirmation: boolean;
    rejection: boolean;
  };
};

export type AdminBookingBike = {
  heightCm: number;
  bikeSize: string;
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
};

type LocationFilter = { key: RentalLocation; label: string };

const statusFilters = [
  { key: "all", label: "Alle Status" },
  { key: "unanswered", label: "Unbeantwortet" },
  { key: "pending", label: "Buchung Ausstehend" },
  { key: "confirmed", label: "Buchung Bestätigt" },
  { key: "executed", label: "Ausgeführt" },
  { key: "cancelled", label: "Buchung Storniert" },
  { key: "rejected", label: "Abgelehnt" },
] as const;

function PaymentBadge({ booking }: { booking: AdminBooking }) {
  if (booking.status !== "confirmed" && booking.status !== "executed" && booking.status !== "cancelled") return null;

  const isPaid = booking.totalPriceCents === 0 || booking.paidAmountCents >= booking.totalPriceCents;
  return (
    <Badge
      variant="outline"
      className={
        isPaid ? "border-[#639754] bg-[#639754]/15 text-[#426537]" : "border-[#D61F1F] bg-[#D61F1F]/10 text-[#D61F1F]"
      }
    >
      {isPaid ? "Bezahlt" : "Unbezahlt"}
    </Badge>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function AdminBookingsTable({
  bookings,
  locations,
  calendarFeedUrl,
}: {
  bookings: AdminBooking[];
  locations: LocationFilter[];
  calendarFeedUrl?: string | null;
}) {
  const [bookingRows, setBookingRows] = useState(bookings);
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    return bookingRows.filter((booking) => {
      const locationMatches = selectedLocation === "all" || selectedLocation === booking.location;
      const statusMatches = selectedStatus === "all" || selectedStatus === booking.status;
      const searchMatches =
        !query ||
        [booking.name, booking.orderNumber, rentalLocationLabels.de[booking.location], ...booking.bikes]
          .join(" ")
          .toLocaleLowerCase("de-DE")
          .includes(query);
      return locationMatches && statusMatches && searchMatches;
    });
  }, [bookingRows, search, selectedLocation, selectedStatus]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buchungen oder Aufträge suchen..."
              aria-label="Buchungen suchen"
            />
          </InputGroup>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {calendarFeedUrl ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                title="Buchungskalender in Apple Kalender abonnieren"
                render={<a href={calendarFeedUrl.replace(/^https?:/, "webcal:")} />}
              >
                <CalendarPlusIcon />
                Apple Kalender
              </Button>
            ) : null}
            <Select value={selectedLocation} onValueChange={(value) => value && setSelectedLocation(value)}>
              <SelectTrigger className="w-44" aria-label="Standort filtern">
                <SelectValue>
                  {selectedLocation === "all"
                    ? "Alle Standorte"
                    : (locations.find((location) => location.key === selectedLocation)?.label ?? "Standort")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Alle Standorte</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.key} value={location.key}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(value) => value && setSelectedStatus(value)}>
              <SelectTrigger className="w-48" aria-label="Status filtern">
                <SelectValue>
                  {statusFilters.find((status) => status.key === selectedStatus)?.label ?? "Status"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusFilters.map((status) => (
                    <SelectItem key={status.key} value={status.key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Manuelle Buchung hinzufügen"
              title="Manuelle Buchung hinzufügen"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredBookings.length ? (
          <ItemGroup>
            {filteredBookings.map((booking) => {
              return (
                <Item
                  key={booking.id}
                  variant="muted"
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedBooking(booking)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedBooking(booking);
                    }
                  }}
                >
                  <ItemContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemTitle>
                        {booking.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          {booking.orderNumber.startsWith("#") ? booking.orderNumber : `#${booking.orderNumber}`}
                        </span>
                      </ItemTitle>
                    </div>
                    <ItemDescription className="text-xs tracking-wide uppercase">
                      {booking.bikes.length ? booking.bikes.join(", ") : (booking.bikeTitle ?? "Keine Fahrraddaten")} ·{" "}
                      {formatDate(booking.periodFrom)} - {formatDate(booking.periodTo)}
                    </ItemDescription>
                  </ItemContent>
                  <div className="flex shrink-0 items-center gap-6">
                    {booking.status === "unanswered" ? (
                      <AdminBookingMailActions
                        booking={booking}
                        onSent={(action) => {
                          setBookingRows((current) =>
                            current.map((row) =>
                              row.id === booking.id
                                ? {
                                    ...row,
                                    status: action === "confirmation" ? "pending" : "rejected",
                                    mailActions: { ...row.mailActions, [action]: true },
                                  }
                                : row,
                            ),
                          );
                        }}
                      />
                    ) : booking.status === "confirmed" ? (
                      <AdminBookingStatusActions
                        booking={booking}
                        onExecuted={() => {
                          setBookingRows((current) =>
                            current.map((row) => (row.id === booking.id ? { ...row, status: "executed" } : row)),
                          );
                        }}
                      />
                    ) : (
                      <StatusBadge status={booking.status} />
                    )}
                    <PaymentBadge booking={booking} />
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs tracking-wider text-muted-foreground uppercase">Wert</span>
                      <span className="font-medium tabular-nums">{formatPrice(booking.totalPriceCents)}</span>
                    </div>
                  </div>
                </Item>
              );
            })}
          </ItemGroup>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Keine Buchungen gefunden.
          </div>
        )}
      </CardContent>
      <AdminBookingDialog
        key={createOpen ? "new-booking-open" : "new-booking-closed"}
        booking={null}
        locations={locations}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(createdBooking) => {
          setBookingRows((current) => [createdBooking, ...current]);
          setCreateOpen(false);
        }}
      />
      {selectedBooking ? (
        <AdminBookingDialog
          key={selectedBooking.id}
          booking={selectedBooking}
          locations={locations}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedBooking(null);
          }}
          onSaved={(updatedBooking) => {
            setBookingRows((current) =>
              current.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking)),
            );
            setSelectedBooking(updatedBooking);
          }}
        />
      ) : null}
    </Card>
  );
}
