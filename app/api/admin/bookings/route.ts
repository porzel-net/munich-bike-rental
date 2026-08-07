import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessAdmin, canAccessLocation, getServerSession } from "../../../../lib/auth/session";
import { BookingCommandError, createBooking, createDirectBooking } from "../../../../lib/bookings/service";
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
]);

export async function POST(request: Request) {
  const session = await getServerSession();
  const input = schema.safeParse(await readBoundedJson(request));
  if (
    !hasTrustedOrigin(request) ||
    !session ||
    !session.user.twoFactorEnabled ||
    !canAccessAdmin(session.user) ||
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
    source: "manual" as const,
    quotedTotalCents: input.data.quotedTotalCents,
    requestedItems: input.data.requestedItems,
  };
  try {
    const created =
      input.data.mode === "direct"
        ? createDirectBooking(getDatabase(), {
            ...common,
            assetsByPosition: input.data.assetsByPosition,
            actorUserId: session.user.id,
          })
        : createBooking(getDatabase(), common, session.user.id);
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Could not create booking" },
      { status: 409 },
    );
  }
}
