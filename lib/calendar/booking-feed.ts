import { createHash } from "node:crypto";

import { rentalLocationLabels, type RentalLocation } from "../inquiries/catalog";

export const calendarBookingStatuses = ["offer_sent", "confirmed", "checked_out", "completed"] as const;

export type BookingCalendarRow = {
  id: number;
  orderNumber: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  message: string;
  totalPriceCents: number;
  status: (typeof calendarBookingStatuses)[number];
  source: "automatic" | "manual";
  submittedAt: Date;
  bikes: string[];
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

function formatPrice(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function statusLabel(status: BookingCalendarRow["status"]) {
  return status === "offer_sent" ? "Angebot versendet" : status === "confirmed" ? "Verbindlich gebucht" : status === "checked_out" ? "Fahrrad ausgegeben" : "Abgeschlossen";
}

function calendarTitleStatus(status: BookingCalendarRow["status"]) {
  return status === "offer_sent" ? "Angebot" : status === "confirmed" ? "Bestätigt" : status === "checked_out" ? "Ausgegeben" : "Abgeschlossen";
}

function foldLine(line: string) {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  for (let index = 75; index < line.length; index += 74) {
    chunks.push(` ${line.slice(index, index + 74)}`);
  }
  return chunks.join("\r\n");
}

export function buildBookingCalendarFeed(bookings: BookingCalendarRow[]) {
  const events = bookings.map((booking) => {
    const description = [
      `Auftragsnummer: ${booking.orderNumber}`,
      `Name: ${booking.name}`,
      `E-Mail: ${booking.email}`,
      `Telefon: ${booking.phone}`,
      `Status: ${statusLabel(booking.status)}`,
      `Quelle: ${booking.source === "manual" ? "Manuell" : "Automatisch"}`,
      `Fahrräder: ${booking.bikes.join(" / ") || "Keine Fahrraddaten"}`,
      `Abholung: ${booking.periodFrom} um ${booking.pickupTime} Uhr`,
      `Rückgabe: ${booking.periodTo} um ${booking.dropoffTime} Uhr`,
      `Ort: ${rentalLocationLabels.de[booking.location as RentalLocation] ?? booking.locationAddress}`,
      `Adresse: ${booking.locationAddress}`,
      `Wert: ${formatPrice(booking.totalPriceCents)}`,
      `Nachricht: ${booking.message || "Keine Nachricht"}`,
    ].join("\n");
    const uid = `booking-${booking.id}@munich-bike-rental.de`;
    const calendarStatus = booking.status === "offer_sent" ? "TENTATIVE" : "CONFIRMED";

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatUtcDateTime(booking.submittedAt)}`,
      `DTSTART;TZID=Europe/Berlin:${formatLocalDateTime(booking.periodFrom, booking.pickupTime)}`,
      `DTEND;TZID=Europe/Berlin:${formatLocalDateTime(booking.periodTo, booking.dropoffTime)}`,
      `SUMMARY:${escapeText(`${calendarTitleStatus(booking.status)} - ${booking.bikes.join(" / ") || "Fahrradgröße unbekannt"}: ${booking.name} ${booking.orderNumber}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(booking.locationAddress)}`,
      `STATUS:${calendarStatus}`,
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
    "X-WR-CALNAME:Munich Bike Rental Buchungen",
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
