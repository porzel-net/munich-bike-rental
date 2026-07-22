import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  canAccessAdmin,
  canAccessLocation,
  getAssignedLocation,
  getServerSession,
  isAdmin,
} from "../../../../lib/auth/session";
import { getDatabase } from "../../../../lib/db/client";
import { rentalInquiries } from "../../../../lib/db/schema";
import { rentalLocations, type RentalLocation } from "../../../../lib/inquiries/catalog";
import { expirePendingBookingConfirmations } from "../../../../lib/inquiries/confirmation";
import { createOrderNumber } from "../../../../lib/inquiries/server";
import { saveRentalInquiry } from "../../../../lib/inquiries/repository";

export const runtime = "nodejs";

function isRentalLocation(value: string | null): value is RentalLocation {
  return value !== null && rentalLocations.includes(value as RentalLocation);
}

const manualBookingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(1).max(64),
  location: z.enum(rentalLocations),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  dropoffTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  totalPriceCents: z.number().int().min(0).max(10_000_000),
  message: z.string().trim().min(1).max(5_000),
  status: z.enum(["rejected", "pending", "confirmed", "executed", "cancelled", "unanswered"]),
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
    .max(10),
});

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const input = manualBookingSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !canAccessLocation(session.user, input.data.location)) {
    return NextResponse.json({ message: "Invalid booking" }, { status: 400 });
  }

  const payload = {
    name: input.data.name,
    contact: input.data.email,
    phone: input.data.phone,
    location: input.data.location,
    periodFrom: input.data.periodFrom,
    periodTo: input.data.periodTo,
    pickupTime: input.data.pickupTime,
    dropoffTime: input.data.dropoffTime,
    message: input.data.message,
    bikeTitle: "",
    locale: "de" as const,
    affiliateKey: "",
    website: "",
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
  };
  const orderNumber = createOrderNumber();
  const created = saveRentalInquiry(
    getDatabase(),
    payload,
    orderNumber,
    input.data.totalPriceCents,
    new Date(),
    input.data.status,
    "manual",
  );

  return NextResponse.json({ ok: true, id: created.id, orderNumber }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session || !session.user.twoFactorEnabled || !canAccessAdmin(session.user)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const db = getDatabase();
  expirePendingBookingConfirmations(db);

  const requestedLocation = new URL(request.url).searchParams.get("location");
  if (requestedLocation !== null && !isRentalLocation(requestedLocation)) {
    return NextResponse.json({ message: "Invalid location" }, { status: 400 });
  }

  const assignedLocation = getAssignedLocation(session.user);
  if (!isAdmin(session.user) && !assignedLocation) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  if (!isAdmin(session.user) && requestedLocation && requestedLocation !== assignedLocation) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const location = isAdmin(session.user) ? requestedLocation : assignedLocation;
  const query = db
    .select({
      id: rentalInquiries.id,
      orderNumber: rentalInquiries.orderNumber,
      name: rentalInquiries.name,
      email: rentalInquiries.email,
      location: rentalInquiries.location,
      totalPriceCents: rentalInquiries.totalPriceCents,
      mailStatus: rentalInquiries.mailStatus,
      status: rentalInquiries.status,
      source: rentalInquiries.source,
      submittedAt: rentalInquiries.submittedAt,
    })
    .from(rentalInquiries)
    .orderBy(desc(rentalInquiries.submittedAt))
    .limit(100);

  const inquiries = location ? query.where(eq(rentalInquiries.location, location)).all() : query.all();
  return NextResponse.json({ inquiries }, { headers: { "Cache-Control": "no-store" } });
}
