import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessLocation, getServerSession } from "../../../../../lib/auth/session";
import { getDatabase } from "../../../../../lib/db/client";
import { accountingRevenues, rentalInquiryBikes, rentalInquiries } from "../../../../../lib/db/schema";
import { rentalLocations, type RentalLocation } from "../../../../../lib/inquiries/catalog";
import { calculateInquiryPrice } from "../../../../../lib/inventory/pricing";
import { getLocationInventory } from "../../../../../lib/inventory/repository";
import type { ContactInquiry } from "../../../../../lib/inquiries/schemas";

export const runtime = "nodejs";

const updateInquirySchema = z.object({
  status: z.enum(["rejected", "pending", "confirmed", "executed", "cancelled", "unanswered"]).optional(),
  periodFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  periodTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pickupTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  dropoffTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  totalPriceCents: z.number().int().min(0).max(10_000_000).optional(),
  bikes: z
    .array(
      z.object({
        heightCm: z.number().int().min(100).max(250),
        bikeSize: z.string().trim().min(1).max(120),
        needsPedals: z.boolean(),
        pedalType: z.string().trim().max(32).nullable(),
        needsComputerMount: z.boolean(),
        computerMountType: z.string().trim().max(32).nullable(),
        needsHelmet: z.boolean(),
        needsClothing: z.boolean(),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
});

const priceCalculationSchema = z.object({
  location: z.enum(rentalLocations),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bikes: updateInquirySchema.shape.bikes.unwrap(),
});

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const inquiryId = Number((await params).id);
  if (!Number.isSafeInteger(inquiryId) || inquiryId < 0)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const input = priceCalculationSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !canAccessLocation(session.user, input.data.location)) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const price = calculateInquiryPrice(getLocationInventory(getDatabase(), input.data.location), {
    periodFrom: input.data.periodFrom,
    periodTo: input.data.periodTo,
    bikes: input.data.bikes.map((bike) => ({
      height: String(bike.heightCm),
      bikeSize: bike.bikeSize,
      needsPedals: bike.needsPedals,
      pedalType: bike.pedalType ?? "",
      needsComputerMount: bike.needsComputerMount,
      computerMountType: bike.computerMountType ?? "",
      needsHelmet: bike.needsHelmet,
      needsClothing: bike.needsClothing,
    })),
  } as ContactInquiry);

  return NextResponse.json({ totalPriceCents: price.totalCents, rentalDays: price.rentalDays });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inquiryId = Number(id);
  if (!Number.isSafeInteger(inquiryId) || inquiryId < 1)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const update = updateInquirySchema.safeParse(await request.json().catch(() => null));
  if (!update.success || Object.keys(update.data).length === 0) {
    return NextResponse.json({ message: "Invalid update" }, { status: 400 });
  }

  const db = getDatabase();
  const inquiry = db
    .select({
      id: rentalInquiries.id,
      location: rentalInquiries.location,
      name: rentalInquiries.name,
      totalPriceCents: rentalInquiries.totalPriceCents,
      status: rentalInquiries.status,
    })
    .from(rentalInquiries)
    .where(eq(rentalInquiries.id, inquiryId))
    .get();

  // Return 404 rather than revealing whether another location has this record.
  if (!inquiry || !canAccessLocation(session.user, inquiry.location as RentalLocation)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const existingRevenue = db
    .select({ id: accountingRevenues.id, paidAmountCents: accountingRevenues.paidAmountCents })
    .from(accountingRevenues)
    .where(eq(accountingRevenues.inquiryId, inquiry.id))
    .get();
  const nextStatus = update.data.status ?? inquiry.status;
  if (
    ["pending", "confirmed"].includes(inquiry.status) &&
    nextStatus !== "pending" &&
    nextStatus !== "confirmed" &&
    nextStatus !== "executed" &&
    (existingRevenue?.paidAmountCents ?? 0) > 0
  ) {
    return NextResponse.json(
      { message: "Der Auftragsstatus kann nach einem Zahlungseingang nicht zurückgesetzt werden." },
      { status: 409 },
    );
  }

  const { bikes, ...inquiryUpdate } = update.data;
  const now = new Date();
  db.transaction((transaction) => {
    if (Object.keys(inquiryUpdate).length > 0) {
      transaction.update(rentalInquiries).set(inquiryUpdate).where(eq(rentalInquiries.id, inquiry.id)).run();
    }

    if (bikes) {
      transaction.delete(rentalInquiryBikes).where(eq(rentalInquiryBikes.inquiryId, inquiry.id)).run();
      transaction
        .insert(rentalInquiryBikes)
        .values(
          bikes.map((bike, index) => ({
            inquiryId: inquiry.id,
            position: index + 1,
            heightCm: bike.heightCm,
            bikeSize: bike.bikeSize,
            needsPedals: bike.needsPedals,
            pedalType: bike.pedalType || null,
            needsComputerMount: bike.needsComputerMount,
            computerMountType: bike.computerMountType || null,
            needsHelmet: bike.needsHelmet,
            needsClothing: bike.needsClothing,
          })),
        )
        .run();
    }

    if (nextStatus === "confirmed" || nextStatus === "cancelled") {
      const nextAmountCents = update.data.totalPriceCents ?? inquiry.totalPriceCents;
      const revenueAmountCents = nextStatus === "cancelled" ? Math.round(nextAmountCents / 2) : nextAmountCents;
      if (existingRevenue) {
        transaction
          .update(accountingRevenues)
          .set({ amountCents: revenueAmountCents, payerName: inquiry.name, updatedAt: now })
          .where(eq(accountingRevenues.id, existingRevenue.id))
          .run();
      } else {
        transaction
          .insert(accountingRevenues)
          .values({
            inquiryId: inquiry.id,
            amountCents: revenueAmountCents,
            paidAmountCents: 0,
            paymentReceivedAt: null,
            payerName: inquiry.name,
            notes: "",
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    } else if (
      existingRevenue &&
      (nextStatus === "rejected" || nextStatus === "unanswered" || nextStatus === "pending") &&
      existingRevenue.paidAmountCents === 0
    ) {
      transaction.delete(accountingRevenues).where(eq(accountingRevenues.id, existingRevenue.id)).run();
    }
  });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
