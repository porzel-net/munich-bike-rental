import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "../../../lib/db/client";
import { confirmBookingWithToken, expirePendingBookingConfirmations } from "../../../lib/inquiries/confirmation";
import { rentalInquiryMailActions, rentalInquiries } from "../../../lib/db/schema";
import { moveMailToMailbox } from "../../../lib/inquiries/mailbox";
import { siteConfig } from "../../../lib/site";

export const runtime = "nodejs";

const requestSchema = z.object({ token: z.string().trim().min(32).max(128) });

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.APP_ORIGIN?.trim() || new URL(siteConfig.url).origin;
  return origin === configuredOrigin || origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Invalid confirmation link" }, { status: 400 });

  const db = getDatabase();
  expirePendingBookingConfirmations(db);
  const result = confirmBookingWithToken(db, input.data.token);
  if (!result.ok) {
    return NextResponse.json(
      {
        code: result.reason,
        message:
          result.reason === "expired"
            ? "Dein Buchungslink ist nach 24 Stunden abgelaufen. Bitte fordere einen neuen Buchungslink an."
            : result.reason === "rejected"
              ? "Diese Buchung kann nicht mehr bestätigt werden."
              : result.reason === "unavailable"
                ? "Das ausgewählte Fahrrad ist für diesen Zeitraum inzwischen nicht mehr verfügbar."
                : "Dieser Bestätigungslink ist ungültig.",
      },
      { status: result.reason === "unavailable" ? 409 : 410 },
    );
  }

  const confirmationMail = db
    .select({ messageId: rentalInquiryMailActions.messageId })
    .from(rentalInquiryMailActions)
    .innerJoin(rentalInquiries, eq(rentalInquiries.id, rentalInquiryMailActions.inquiryId))
    .where(
      and(
        eq(rentalInquiries.orderNumber, result.booking.orderNumber),
        eq(rentalInquiryMailActions.action, "confirmation"),
      ),
    )
    .get();
  const mailbox = result.alreadyConfirmed
    ? { configured: true, moved: true }
    : await moveMailToMailbox(
        confirmationMail?.messageId ?? null,
        process.env.IMAP_MAIN_PENDING_MAILBOX?.trim() || "Ausstehend",
      );

  return NextResponse.json(
    {
      ok: true,
      alreadyConfirmed: result.alreadyConfirmed,
      booking: result.booking,
      mailboxMoved: mailbox.moved,
      mailboxWarning: mailbox.moved
        ? null
        : "Die Buchung wurde bestätigt, aber die Mail konnte nicht nach „Ausstehend“ verschoben werden.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
