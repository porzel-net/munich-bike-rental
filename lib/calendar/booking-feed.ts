import { createHash } from "node:crypto";

import type { BookingStatus } from "../db/schema";
import { rentalLocationLabels, type RentalLocation } from "../inquiries/catalog";

/** Only operationally relevant booking states are published to subscribed calendars. */
export const calendarBookingStatuses = [
  "inquiry_received",
  "offer_sent",
  "confirmed",
  "completed",
] as const satisfies readonly BookingStatus[];

export type CalendarBookingItem = {
  requestedLabel: string;
  heightCm: number;
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
};

export type BookingCalendarRow = {
  id: number;
  bookingUrl: string;
  orderNumber: string;
  name: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  status: (typeof calendarBookingStatuses)[number];
  source: "automatic" | "web" | "manual" | "legacy";
  submittedAt: Date;
  updatedAt: Date;
  version: number;
  items: CalendarBookingItem[];
  bikes: string[];
  accessories: string[];
  locationAddress: string;
};

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function formatLocalDateTime(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function formatUtcDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function statusLabel(status: BookingCalendarRow["status"]) {
  return {
    inquiry_received: "Anfrage eingegangen",
    offer_sent: "Angebot versendet",
    confirmed: "Verbindlich gebucht",
    completed: "Abgeschlossen",
  }[status];
}

function calendarTitleStatus(status: BookingCalendarRow["status"]) {
  return {
    inquiry_received: "Anfrage",
    offer_sent: "Angebot",
    confirmed: "Bestätigt",
    completed: "Abgeschlossen",
  }[status];
}

function calendarStatus(status: BookingCalendarRow["status"]) {
  if (status === "inquiry_received" || status === "offer_sent") return "TENTATIVE";
  return "CONFIRMED";
}

function sourceLabel(source: BookingCalendarRow["source"]) {
  return source === "manual" ? "Manuell" : source === "legacy" ? "Importiert" : "Automatisch";
}

function itemDescription(item: CalendarBookingItem) {
  const equipment = [
    item.needsPedals ? `Pedale${item.pedalType ? ` (${item.pedalType})` : ""}` : null,
    item.needsComputerMount ? `Computerhalterung${item.computerMountType ? ` (${item.computerMountType})` : ""}` : null,
    item.needsHelmet ? "Helm" : null,
    item.needsClothing ? "Radbekleidung" : null,
  ].filter((value): value is string => Boolean(value));
  return `${item.requestedLabel} · Körpergröße ${item.heightCm} cm${equipment.length ? ` · ${equipment.join(", ")}` : ""}`;
}

/**
 * RFC 5545 folds content lines at 75 UTF-8 octets. Array.from keeps surrogate
 * pairs intact, while TextEncoder makes the fold correct for German umlauts
 * and any customer-entered non-ASCII text.
 */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const character of Array.from(line)) {
    const characterBytes = encoder.encode(character).byteLength;
    if (current && currentBytes + characterBytes > limit) {
      chunks.push(current);
      current = ` ${character}`;
      currentBytes = 1 + characterBytes;
      limit = 74;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n");
}

export function buildBookingCalendarFeed(bookings: BookingCalendarRow[], options: { calendarName?: string } = {}) {
  const events = bookings.map((booking) => {
    const requestedItems = booking.items.map(itemDescription);
    const description = [
      `Buchung öffnen: ${booking.bookingUrl}`,
      `Auftragsnummer: ${booking.orderNumber}`,
      `Name: ${booking.name}`,
      `Status: ${statusLabel(booking.status)}`,
      `Quelle: ${sourceLabel(booking.source)}`,
      `Fahrräder: ${booking.bikes.join(" / ") || "Keine Fahrraddaten"}`,
      `Anfragen: ${requestedItems.join(" | ") || "Keine Fahrraddaten"}`,
      `Zubehör: ${booking.accessories.join(" / ") || "Kein Zubehör"}`,
      `Abholung: ${booking.periodFrom} um ${booking.pickupTime} Uhr`,
      `Rückgabe: ${booking.periodTo} um ${booking.dropoffTime} Uhr`,
      `Ort: ${rentalLocationLabels.de[booking.location as RentalLocation] ?? booking.locationAddress}`,
      `Adresse: ${booking.locationAddress}`,
    ].join("\n");
    const uid = `booking-${booking.id}@munich-bike-rental.de`;

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatUtcDateTime(booking.submittedAt)}`,
      `LAST-MODIFIED:${formatUtcDateTime(booking.updatedAt)}`,
      `SEQUENCE:${Math.max(0, booking.version - 1)}`,
      `DTSTART;TZID=Europe/Berlin:${formatLocalDateTime(booking.periodFrom, booking.pickupTime)}`,
      `DTEND;TZID=Europe/Berlin:${formatLocalDateTime(booking.periodTo, booking.dropoffTime)}`,
      `SUMMARY:${escapeText(`${calendarTitleStatus(booking.status)} · ${booking.bikes.join(" / ") || "Fahrrad"} · ${booking.name} · ${booking.orderNumber}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(booking.locationAddress)}`,
      `STATUS:${calendarStatus(booking.status)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ].join("\r\n");
  });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Munich Bike Rental//Buchungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "Munich Bike Rental Buchungen")}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events,
    "END:VCALENDAR",
  ]
    .join("\r\n")
    .split("\r\n")
    .map(foldLine)
    .join("\r\n")
    .concat("\r\n");

  return { body, etag: `"${createHash("sha256").update(body).digest("hex")}"` };
}
