import { createHash } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { isAdmin, getVisibleLocationScope, type AuthorizedUser } from "@/lib/auth/authorization";
import type { AppDatabase } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { carddavUsername } from "@/lib/carddav/config";
import { escapeVCard } from "./contact-card";

export type ContactBooking = {
  id: number;
  orderNumber: string;
  location: string;
  status: string;
  periodFrom: string;
  periodTo: string;
  updatedAt: Date;
};

export type VisibleContact = {
  key: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  locations: string[];
  latestUpdatedAt: Date;
  bookings: ContactBooking[];
};

export const APP_MANAGED_CONTACT_UID_PREFIX = "urn:munich-bike-rental:contact:";

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function contactKey(booking: { customerName: string; customerEmail: string; customerPhone: string }) {
  const email = normalizeEmail(booking.customerEmail);
  if (email) return `email:${email}`;
  const phone = normalizePhone(booking.customerPhone);
  if (phone) return `phone:${phone}`;
  return `name:${booking.customerName.trim().toLocaleLowerCase("de-DE")}`;
}

function contactUid(key: string) {
  return `${APP_MANAGED_CONTACT_UID_PREFIX}${createHash("sha256").update(key, "utf8").digest("hex")}`;
}

export function getVisibleContacts(db: AppDatabase, user: AuthorizedUser & { id?: string | null }) {
  const location = getVisibleLocationScope(user);
  if (!isAdmin(user) && !location) return [];

  const query = db
    .select({
      id: bookings.id,
      orderNumber: bookings.orderNumber,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      location: bookings.location,
      status: bookings.status,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .orderBy(desc(bookings.updatedAt));
  const rows = location ? query.where(eq(bookings.location, location)).all() : query.all();
  const grouped = new Map<string, VisibleContact>();

  for (const row of rows) {
    const key = contactKey(row);
    const existing = grouped.get(key);
    const booking = {
      id: row.id,
      orderNumber: row.orderNumber,
      location: row.location,
      status: row.status,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      updatedAt: row.updatedAt,
    } satisfies ContactBooking;
    if (existing) {
      existing.bookings.push(booking);
      if (!existing.locations.includes(row.location)) existing.locations.push(row.location);
      continue;
    }

    grouped.set(key, {
      key,
      uid: contactUid(key),
      name: row.customerName.trim(),
      email: row.customerEmail.trim(),
      phone: row.customerPhone.trim(),
      locations: [row.location],
      latestUpdatedAt: row.updatedAt,
      bookings: [booking],
    });
  }

  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "de-DE"));
}

export function contactToVCard(contact: VisibleContact) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${contact.uid}`,
    `FN:${escapeVCard(contact.name)}`,
    `N:${escapeVCard(contact.name)};;;;`,
    contact.email ? `EMAIL;TYPE=INTERNET:${escapeVCard(contact.email)}` : null,
    contact.phone ? `TEL;TYPE=CELL,VOICE:${escapeVCard(contact.phone)}` : null,
    "ORG:Munich Bike Rental",
    `NOTE:${escapeVCard(`Buchungen: ${contact.bookings.map((booking) => booking.orderNumber).join(", ")}`)}`,
    "END:VCARD",
  ].filter((line): line is string => line !== null);
  return `${lines.join("\r\n")}\r\n`;
}

export function visibleContactCarddavUsername(userId: string) {
  return carddavUsername(userId);
}
