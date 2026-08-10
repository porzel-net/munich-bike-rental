import { NextResponse } from "next/server";

import { getDatabase } from "../../../lib/db/client";
import { createBooking } from "../../../lib/bookings/service";
import { dispatchOutboxForBooking } from "../../../lib/bookings/outbox";
import { estimateInquiryQuote } from "../../../lib/bookings/quotes";
import { contactInquirySchema } from "../../../lib/inquiries/schemas";
import { jsonError, parseInquiryRequest } from "../../../lib/inquiries/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = await parseInquiryRequest(request, "contact", contactInquirySchema);
    if ("error" in parsed) return parsed.error;

    const { locale, contact, bikes } = parsed.data;
    const database = getDatabase();
    // An inquiry is deliberately accepted even if the requested model is not
    // currently offerable. Staff can reject it or send a concrete alternative.
    const totalPriceCents = estimateInquiryQuote(database, parsed.data).totalCents;
    const created = createBooking(database, {
      customerName: parsed.data.name,
      customerEmail: contact,
      customerPhone: parsed.data.phone,
      location: parsed.data.location,
      periodFrom: parsed.data.periodFrom,
      periodTo: parsed.data.periodTo,
      pickupTime: parsed.data.pickupTime,
      dropoffTime: parsed.data.dropoffTime,
      customerMessage: parsed.data.message,
      communicationLocale: locale,
      source: "web",
      quotedTotalCents: totalPriceCents,
      requestedItems: bikes.map((bike) => ({
        requestedLabel: bike.bikeSize,
        heightCm: Number(bike.height),
        needsPedals: bike.needsPedals,
        pedalType: bike.pedalType,
        needsComputerMount: bike.needsComputerMount,
        computerMountType: bike.computerMountType,
        needsHelmet: bike.needsHelmet,
        needsClothing: bike.needsClothing,
        needsBikepackingBag: bike.needsBikepackingBag,
        needsGlasses: bike.needsGlasses,
        bottleHolderIncluded: bike.bottleHolderIncluded,
        repairKitIncluded: bike.repairKitIncluded,
      })),
    });
    await dispatchOutboxForBooking(database, created.id);
    return NextResponse.json(
      { ok: true, orderNumber: created.orderNumber, totalPriceCents },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
