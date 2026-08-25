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
import { adminBookingFieldsSchema } from "../../../../lib/bookings/input-schemas";
import { getDatabase } from "../../../../lib/db/client";
import type { RentalLocation } from "../../../../lib/rental-locations";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("mode", [
  adminBookingFieldsSchema.extend({ mode: z.literal("inquiry") }),
  adminBookingFieldsSchema.extend({
    mode: z.literal("direct"),
    assetsByPosition: z.record(z.string(), z.number().int().positive()),
  }),
  adminBookingFieldsSchema.extend({
    mode: z.literal("historical"),
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
    return NextResponse.json(
      {
        message:
          "Die Buchung ist unvollständig oder ungültig. Prüfe Kundendaten, Standort, Zeitraum und Fahrradauswahl.",
      },
      { status: 400 },
    );
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
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Die Buchung konnte nicht angelegt werden. Prüfe die Eingaben und versuche es erneut.",
      },
      { status: 409 },
    );
  }
}
