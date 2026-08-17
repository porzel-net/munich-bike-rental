import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessLocation, canUseAdminApi, getServerSession } from "../../../../lib/auth/session";
import {
  BookingCommandError,
  createBooking,
  createDirectBooking,
  createHistoricalBooking,
} from "../../../../lib/bookings/service";
import { dispatchNextOutboxMail } from "../../../../lib/bookings/outbox";
import { mailOutbox } from "../../../../lib/db/schema";
import { isValidIsoDate, isValidTime } from "../../../../lib/bookings/validation";
import { getDatabase } from "../../../../lib/db/client";
import { rentalLocations, type RentalLocation } from "../../../../lib/inquiries/catalog";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const item = z.object({
  requestedLabel: z.string().trim().min(1).max(120),
  heightCm: z.number().int().min(100).max(250),
  needsPedals: z.boolean().default(false),
  pedalType: z.string().trim().max(32).nullable().default(null),
  needsComputerMount: z.boolean().default(false),
  computerMountType: z.string().trim().max(32).nullable().default(null),
  needsHelmet: z.boolean().default(false),
  needsClothing: z.boolean().default(false),
  needsBikepackingBag: z.boolean().default(false),
  needsGlasses: z.boolean().default(false),
  bottleHolderIncluded: z.boolean().default(true),
  repairKitIncluded: z.boolean().default(true),
});
const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("inquiry"),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1).max(64),
    location: z.enum(rentalLocations),
    periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
    periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
    pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
    dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
    message: z.string().trim().max(5000).default(""),
    locale: z.enum(["de", "en"]),
    quotedTotalCents: z.number().int().min(0),
    requestedItems: z.array(item).min(1).max(10),
  }),
  z.object({
    mode: z.literal("direct"),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1).max(64),
    location: z.enum(rentalLocations),
    periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
    periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
    pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
    dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
    message: z.string().trim().max(5000).default(""),
    locale: z.enum(["de", "en"]),
    quotedTotalCents: z.number().int().min(0),
    requestedItems: z.array(item).min(1).max(10),
    assetsByPosition: z.record(z.string(), z.number().int().positive()),
  }),
  z.object({
    mode: z.literal("historical"),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1).max(64),
    location: z.enum(rentalLocations),
    periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
    periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
    pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
    dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
    message: z.string().trim().max(5000).default(""),
    locale: z.enum(["de", "en"]),
    quotedTotalCents: z.number().int().min(0),
    invoiceNumber: z.string().trim().min(1).max(32),
    requestedItems: z.array(item).min(1).max(10),
    assetsByPosition: z.record(z.string(), z.number().int().positive()),
  }),
]);

export async function POST(request: Request) {
  const session = await getServerSession();
  const input = schema.safeParse(await readBoundedJson(request));
  if (
    !hasTrustedOrigin(request) ||
    !session ||
    !canUseAdminApi(session.user) ||
    !input.success ||
    !canAccessLocation(session.user, input.data.location as RentalLocation)
  )
    return NextResponse.json({ message: "Invalid booking" }, { status: 400 });
  const common = {
    customerName: input.data.name,
    customerEmail: input.data.email,
    customerPhone: input.data.phone,
    location: input.data.location,
    periodFrom: input.data.periodFrom,
    periodTo: input.data.periodTo,
    pickupTime: input.data.pickupTime,
    dropoffTime: input.data.dropoffTime,
    customerMessage: input.data.message,
    communicationLocale: input.data.locale,
    quotedTotalCents: input.data.quotedTotalCents,
    requestedItems: input.data.requestedItems,
  };
  try {
    const database = getDatabase();
    const created =
      input.data.mode === "historical"
        ? createHistoricalBooking(database, {
            ...common,
            assetsByPosition: Object.fromEntries(
              Object.entries(input.data.assetsByPosition).map(([position, assetId]) => [Number(position), assetId]),
            ),
            invoiceNumber: input.data.invoiceNumber,
            actorUserId: session.user.id,
          })
        : input.data.mode === "direct"
          ? createDirectBooking(database, {
              ...common,
              source: "manual",
              assetsByPosition: input.data.assetsByPosition,
              actorUserId: session.user.id,
            })
          : createBooking(database, { ...common, source: "manual" }, session.user.id);

    if (input.data.mode === "direct") {
      const confirmationMailId = database
        .select({ id: mailOutbox.id })
        .from(mailOutbox)
        .where(
          and(
            eq(mailOutbox.bookingId, created.id),
            eq(mailOutbox.kind, "booking_confirmed"),
            eq(mailOutbox.status, "queued"),
          ),
        )
        .get()?.id;
      const mailResult = confirmationMailId ? await dispatchNextOutboxMail(database, confirmationMailId) : null;
      if (mailResult?.status === "failed") {
        return NextResponse.json(
          { message: "Die Direktbuchung wurde angelegt, aber die Bestätigungsmail konnte nicht versendet werden." },
          { status: 502 },
        );
      }
      return NextResponse.json({ ok: true, ...created, mailStatus: mailResult?.status ?? "queued" }, { status: 201 });
    }

    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Could not create booking" },
      { status: 409 },
    );
  }
}
