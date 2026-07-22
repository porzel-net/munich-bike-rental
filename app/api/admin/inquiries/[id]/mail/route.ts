import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessLocation, getServerSession } from "../../../../../../lib/auth/session";
import { getDatabase } from "../../../../../../lib/db/client";
import {
  accountingRevenues,
  rentalInquiryBikes,
  rentalInquiryMailActions,
  rentalInquiries,
} from "../../../../../../lib/db/schema";
import { sendBookingMailAction } from "../../../../../../lib/inquiries/booking-mail-actions";
import {
  createBookingConfirmationToken,
  revokeBookingConfirmationToken,
} from "../../../../../../lib/inquiries/confirmation";
import type { RentalLocation } from "../../../../../../lib/inquiries/catalog";
import { rentalLocationConfigs } from "../../../../../../lib/rental-locations";
import { siteConfig } from "../../../../../../lib/site";
import { getRentalDays } from "../../../../../../lib/inventory/pricing";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["confirmation", "rejection"]),
  forceWithoutThread: z.boolean().optional().default(false),
});

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const inquiryId = Number((await params).id);
  if (!Number.isSafeInteger(inquiryId) || inquiryId < 1) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  const db = getDatabase();
  const inquiry = db
    .select({
      id: rentalInquiries.id,
      orderNumber: rentalInquiries.orderNumber,
      name: rentalInquiries.name,
      email: rentalInquiries.email,
      location: rentalInquiries.location,
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      pickupTime: rentalInquiries.pickupTime,
      dropoffTime: rentalInquiries.dropoffTime,
      totalPriceCents: rentalInquiries.totalPriceCents,
      source: rentalInquiries.source,
      threadMessageId: rentalInquiries.mailThreadMessageId,
    })
    .from(rentalInquiries)
    .where(eq(rentalInquiries.id, inquiryId))
    .get();

  if (!inquiry || !canAccessLocation(session.user, inquiry.location as RentalLocation)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const bikes = db
    .select({ bikeSize: rentalInquiryBikes.bikeSize })
    .from(rentalInquiryBikes)
    .where(eq(rentalInquiryBikes.inquiryId, inquiry.id))
    .all()
    .map((bike) => bike.bikeSize);
  const location = rentalLocationConfigs.find((item) => item.key === inquiry.location);
  const senderFirstName = session.user.name?.trim().split(/\s+/)[0] || "Julius";

  let confirmationToken: string | null = null;
  let confirmationLink: string | undefined;
  if (input.data.action === "confirmation") {
    if (!location) return NextResponse.json({ message: "Unknown booking location" }, { status: 500 });

    const createdToken = createBookingConfirmationToken(db, inquiry.id);
    confirmationToken = createdToken.token;
    const target = new URL(location.path, process.env.APP_ORIGIN?.trim() || siteConfig.url);
    target.searchParams.set("bookingToken", createdToken.token);
    confirmationLink = target.toString();
  }

  const result = await sendBookingMailAction(
    input.data.action,
    {
      ...inquiry,
      bikes,
      rentalDays: getRentalDays(inquiry.periodFrom, inquiry.periodTo),
      locationAddress: location?.address ?? "",
      senderFirstName,
      confirmationLink,
    },
    input.data.forceWithoutThread,
  );
  if (!result.ok) {
    if (confirmationToken) revokeBookingConfirmationToken(db, confirmationToken);
    if (result.reason === "thread_missing") {
      return NextResponse.json(
        {
          ok: false,
          code: "thread_missing",
          message: "Für diese automatische Buchung wurde kein Mailverlauf gefunden.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, message: "Die Mail-Konfiguration ist unvollständig." }, { status: 500 });
  }

  const sentAt = new Date();
  const nextStatus = input.data.action === "confirmation" ? "pending" : "rejected";
  const existingRevenue = db
    .select({ id: accountingRevenues.id, paidAmountCents: accountingRevenues.paidAmountCents })
    .from(accountingRevenues)
    .where(eq(accountingRevenues.inquiryId, inquiry.id))
    .get();
  db.transaction((transaction) => {
    transaction.update(rentalInquiries).set({ status: nextStatus }).where(eq(rentalInquiries.id, inquiry.id)).run();

    if (existingRevenue && (nextStatus === "pending" || nextStatus === "rejected") && existingRevenue.paidAmountCents === 0) {
      transaction.delete(accountingRevenues).where(eq(accountingRevenues.id, existingRevenue.id)).run();
    }

    if (result.threadMessageId && result.threadMessageId !== inquiry.threadMessageId) {
      transaction
        .update(rentalInquiries)
        .set({ mailThreadMessageId: result.threadMessageId })
        .where(eq(rentalInquiries.id, inquiry.id))
        .run();
    }

    transaction
      .insert(rentalInquiryMailActions)
      .values({
        inquiryId: inquiry.id,
        action: input.data.action,
        messageId: result.messageId,
        threadMessageId: result.threadMessageId,
        mailboxMoved: result.mailbox?.moved ?? false,
        sentAt,
      })
      .onConflictDoUpdate({
        target: [rentalInquiryMailActions.inquiryId, rentalInquiryMailActions.action],
        set: {
          messageId: result.messageId,
          threadMessageId: result.threadMessageId,
          mailboxMoved: result.mailbox?.moved ?? false,
          sentAt,
        },
      })
      .run();
  });

  return NextResponse.json(
    {
      ok: true,
      action: input.data.action,
      status: nextStatus,
      mailboxMoved: result.mailbox?.moved ?? false,
      mailboxWarning:
        result.mailbox && !result.mailbox.moved
          ? "Die Mail wurde gesendet, konnte aber nicht automatisch nach „Abgelehnt“ verschoben werden."
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
