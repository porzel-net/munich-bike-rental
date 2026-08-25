import { differenceInCalendarDays } from "date-fns";

import { bookingPresentation } from "@/lib/bookings/presentation";
import type { BookingStatus } from "@/lib/db/schema";
import { berlinDateKey, BUSINESS_TIME_ZONE } from "@/lib/datetime";
import { rentalLocationLabels, type RentalLocation } from "@/lib/inquiries/catalog";

export const calendarWeekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export type CalendarStatusTone = "amber" | "violet" | "blue" | "emerald" | "indigo" | "rose" | "slate";

const locationCodes: Record<RentalLocation, string> = {
  munich: "MUC",
  regensburg: "REG",
  lindau: "LIN",
  friedrichshafen: "FDH",
  konstanz: "KON",
};

export type CalendarBookingSource = {
  id: number;
  orderNumber: string;
  customerName: string;
  location: RentalLocation;
  periodFrom: string;
  periodTo: string;
  status: BookingStatus;
  requestedItems: string[];
  selectedItems?: string[];
  selectedBikes?: CalendarBookingBike[];
  customerPhone: string;
  pickupTime: string;
  dropoffTime: string;
  requestedEquipment: string[];
};

export type CalendarBookingBike = {
  displayName: string;
  nickname: string | null;
};

export type CalendarBookingEvent = {
  id: number;
  orderNumber: string;
  customerName: string;
  location: RentalLocation;
  locationLabel: string;
  locationCode: string;
  status: BookingStatus;
  statusLabel: string;
  tone: CalendarStatusTone;
  startDate: Date;
  endDate: Date;
  displayLabel: string;
  tooltip: string;
  requestedItems: string[];
  selectedItems: string[];
  selectedBikes: CalendarBookingBike[];
  customerPhone: string;
  pickupTime: string;
  dropoffTime: string;
  requestedEquipment: string[];
};

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export type CalendarEventPlacement = {
  event: CalendarBookingEvent;
  startIndex: number;
  span: number;
  lane: number;
};

export type CalendarWeek = {
  days: CalendarDay[];
  events: CalendarEventPlacement[];
  eventLaneCount: number;
};

const statusTones: Record<BookingStatus, CalendarStatusTone> = {
  inquiry_received: "amber",
  offer_sent: "violet",
  confirmed: "blue",
  checked_out: "emerald",
  completed: "indigo",
  rejected: "rose",
  cancelled: "rose",
  expired: "slate",
};

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  // Date-only booking values represent a Berlin calendar day, not a browser-local instant.
  return new Date(Date.UTC(year, month, day, 12));
}

function calendarLabel(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("de-DE", { ...options, timeZone: BUSINESS_TIME_ZONE }).format(value);
}

function formatCalendarRange(startDate: Date, endDate: Date) {
  const start = calendarLabel(startDate, { day: "numeric", month: "long" });
  const end = calendarLabel(endDate, { day: "numeric", month: "long" });
  if (berlinDateKey(startDate) === berlinDateKey(endDate)) return start;
  if (berlinDateKey(startDate).slice(0, 7) === berlinDateKey(endDate).slice(0, 7)) {
    return `${start} – ${calendarLabel(endDate, { day: "numeric" })}`;
  }
  return `${start} – ${end}`;
}

export function getCalendarStatusTone(status: BookingStatus): CalendarStatusTone {
  return statusTones[status];
}

export function getCalendarMonthKey(date: Date) {
  return berlinDateKey(date).slice(0, 7);
}

export function getCalendarMonthLabel(date: Date) {
  return calendarLabel(date, { month: "long", year: "numeric" });
}

export function getCalendarMonthName(date: Date) {
  return calendarLabel(date, { month: "long" });
}

export function getCalendarYearLabel(date: Date) {
  return calendarLabel(date, { year: "numeric" });
}

export function parseCalendarMonthKey(value: string | undefined, fallback = new Date()) {
  const fallbackKey = berlinDateKey(fallback).slice(0, 7);
  if (!value) value = fallbackKey;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) value = fallbackKey;
  const resolved = /^(\d{4})-(\d{2})$/.exec(value);
  if (!resolved) return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1, 12));
  const year = Number(resolved[1]);
  const month = Number(resolved[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11)
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1, 12));
  return new Date(Date.UTC(year, month, 1, 12));
}

export function getCalendarGridRange(monthDate: Date) {
  const monthStart = parseCalendarMonthKey(getCalendarMonthKey(monthDate));
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12));
  const daysFromMonday = (monthStart.getUTCDay() + 6) % 7;
  const daysUntilSunday = (7 - monthEnd.getUTCDay()) % 7;
  return {
    monthStart,
    monthEnd,
    gridStart: new Date(monthStart.getTime() - daysFromMonday * 86_400_000),
    gridEnd: new Date(monthEnd.getTime() + daysUntilSunday * 86_400_000),
  };
}

export function toCalendarBookingEvent(booking: CalendarBookingSource): CalendarBookingEvent {
  const startDate = parseCalendarDate(booking.periodFrom);
  const endDate = parseCalendarDate(booking.periodTo);
  const locationLabel = rentalLocationLabels.de[booking.location] ?? booking.location;
  const locationCode = locationCodes[booking.location];
  const statusLabel = bookingPresentation[booking.status].label;
  const selectedItems = booking.selectedItems?.length ? booking.selectedItems : booking.requestedItems;
  const selectedBikes = booking.selectedBikes?.length
    ? booking.selectedBikes
    : selectedItems.map((displayName) => ({ displayName, nickname: null }));
  const selectedItemsLabel = selectedBikes.length
    ? selectedBikes.map((bike) => bike.nickname || bike.displayName).join(" / ")
    : "Fahrrad unbekannt";
  const selectedBikesLabel = selectedBikes.length
    ? selectedBikes.map((bike) => bike.displayName).join(" / ")
    : "Fahrrad unbekannt";
  const selectedNicknames = selectedBikes
    .map((bike) => bike.nickname?.trim())
    .filter((nickname): nickname is string => Boolean(nickname));

  return {
    id: booking.id,
    orderNumber: booking.orderNumber,
    customerName: booking.customerName,
    location: booking.location,
    locationLabel,
    locationCode,
    status: booking.status,
    statusLabel,
    tone: getCalendarStatusTone(booking.status),
    startDate,
    endDate,
    displayLabel: `${locationCode} · ${selectedItemsLabel}`,
    tooltip: `${booking.customerName} · ${booking.orderNumber} · ${locationLabel} · Bike: ${selectedBikesLabel}${
      selectedNicknames.length ? ` · Spitzname: ${selectedNicknames.join(" / ")}` : ""
    } · ${statusLabel} · ${formatCalendarRange(startDate, endDate)}`,
    requestedItems: booking.requestedItems,
    selectedItems: selectedBikes.map((bike) => bike.displayName),
    selectedBikes,
    customerPhone: booking.customerPhone,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    requestedEquipment: booking.requestedEquipment,
  };
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA <= endB && endA >= startB;
}

function packWeekPlacements(events: CalendarBookingEvent[], weekStart: Date, weekEnd: Date): CalendarEventPlacement[] {
  const visibleEvents = events
    .map((event) => {
      if (event.endDate < weekStart || event.startDate > weekEnd) return null;
      const visibleStart = event.startDate > weekStart ? event.startDate : weekStart;
      const visibleEnd = event.endDate < weekEnd ? event.endDate : weekEnd;
      const startIndex = differenceInCalendarDays(visibleStart, weekStart);
      const span = differenceInCalendarDays(visibleEnd, visibleStart) + 1;

      return {
        event,
        startIndex,
        span,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => {
      if (left.startIndex !== right.startIndex) return left.startIndex - right.startIndex;
      if (left.span !== right.span) return right.span - left.span;
      return left.event.displayLabel.localeCompare(right.event.displayLabel);
    });

  const lanes: Array<Array<{ startIndex: number; endIndex: number }>> = [];

  return visibleEvents.map((entry) => {
    const endIndex = entry.startIndex + entry.span - 1;
    let lane = 0;
    while (lanes[lane]?.some((range) => rangesOverlap(range.startIndex, range.endIndex, entry.startIndex, endIndex))) {
      lane += 1;
    }
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push({ startIndex: entry.startIndex, endIndex });
    return { ...entry, lane };
  });
}

export function buildCalendarWeeks(bookings: CalendarBookingEvent[], monthDate: Date, today = new Date()) {
  const { monthStart, monthEnd, gridStart, gridEnd } = getCalendarGridRange(monthDate);
  const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const allDays = Array.from({ length: dayCount }, (_, index) => new Date(gridStart.getTime() + index * 86_400_000));

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < allDays.length; index += 7) {
    const weekDays = allDays.slice(index, index + 7);
    const events = packWeekPlacements(bookings, weekDays[0], weekDays[6]);
    weeks.push({
      days: weekDays.map((date) => ({
        date,
        isCurrentMonth:
          date.getUTCFullYear() === monthStart.getUTCFullYear() && date.getUTCMonth() === monthStart.getUTCMonth(),
        isToday: berlinDateKey(date) === berlinDateKey(today),
      })),
      events,
      eventLaneCount: events.length ? Math.max(...events.map((event) => event.lane)) + 1 : 0,
    });
  }

  return {
    monthStart,
    monthEnd,
    weeks,
  };
}
