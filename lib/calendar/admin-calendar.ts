import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";

import { bookingPresentation } from "@/lib/bookings/presentation";
import type { BookingStatus } from "@/lib/db/schema";
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
  customerPhone: string;
  pickupTime: string;
  dropoffTime: string;
  requestedEquipment: string[];
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
  return new Date(year, month, day);
}

function formatCalendarRange(startDate: Date, endDate: Date) {
  if (isSameDay(startDate, endDate)) return format(startDate, "d. MMMM", { locale: de });
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${format(startDate, "d. MMMM", { locale: de })} – ${format(endDate, "d.", { locale: de })}`;
  }
  return `${format(startDate, "d. MMMM", { locale: de })} – ${format(endDate, "d. MMMM", { locale: de })}`;
}

export function getCalendarStatusTone(status: BookingStatus): CalendarStatusTone {
  return statusTones[status];
}

export function getCalendarMonthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function getCalendarMonthLabel(date: Date) {
  return format(date, "MMMM yyyy", { locale: de });
}

export function getCalendarMonthName(date: Date) {
  return format(date, "MMMM", { locale: de });
}

export function getCalendarYearLabel(date: Date) {
  return format(date, "yyyy");
}

export function parseCalendarMonthKey(value: string | undefined, fallback = new Date()) {
  if (!value) return startOfMonth(fallback);
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return startOfMonth(fallback);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return startOfMonth(fallback);
  return startOfMonth(new Date(year, month, 1));
}

export function toCalendarBookingEvent(booking: CalendarBookingSource): CalendarBookingEvent {
  const startDate = parseCalendarDate(booking.periodFrom);
  const endDate = parseCalendarDate(booking.periodTo);
  const locationLabel = rentalLocationLabels.de[booking.location] ?? booking.location;
  const locationCode = locationCodes[booking.location];
  const statusLabel = bookingPresentation[booking.status].label;
  const selectedItems = booking.selectedItems?.length ? booking.selectedItems : booking.requestedItems;
  const selectedItemsLabel = selectedItems.length ? selectedItems.join(" / ") : "Fahrrad unbekannt";

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
    tooltip: `${booking.customerName} · ${booking.orderNumber} · ${locationLabel} · ${selectedItemsLabel} · ${statusLabel} · ${formatCalendarRange(
      startDate,
      endDate,
    )}`,
    requestedItems: booking.requestedItems,
    selectedItems,
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
  const monthStart = startOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const dayCount = differenceInCalendarDays(gridEnd, gridStart) + 1;
  const allDays = Array.from({ length: dayCount }, (_, index) => addDays(gridStart, index));

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < allDays.length; index += 7) {
    const weekDays = allDays.slice(index, index + 7);
    const events = packWeekPlacements(bookings, weekDays[0], weekDays[6]);
    weeks.push({
      days: weekDays.map((date) => ({
        date,
        isCurrentMonth: isSameMonth(date, monthStart),
        isToday: isSameDay(date, today),
      })),
      events,
      eventLaneCount: events.length ? Math.max(...events.map((event) => event.lane)) + 1 : 0,
    });
  }

  return {
    monthStart,
    monthEnd: endOfMonth(monthStart),
    weeks,
  };
}
