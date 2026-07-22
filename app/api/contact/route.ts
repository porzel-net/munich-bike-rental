import { NextResponse } from "next/server";

import { computerMountTypeLabels, pedalTypeLabels, rentalLocationLabels } from "../../../lib/inquiries/catalog";
import { getDatabase } from "../../../lib/db/client";
import { getLocationInventory, isRequestAvailable } from "../../../lib/inventory/repository";
import { calculateInquiryPrice } from "../../../lib/inventory/pricing";
import { saveRentalInquiry } from "../../../lib/inquiries/repository";
import { contactInquirySchema } from "../../../lib/inquiries/schemas";
import { createOrderNumber, jsonError, parseInquiryRequest, sendInquiryMail } from "../../../lib/inquiries/server";

export const runtime = "nodejs";

function formatPrice(cents: number, locale: "de" | "en") {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function createMailBody(
  payload: Awaited<ReturnType<typeof contactInquirySchema.parse>>,
  orderNumber: string,
  totalPriceCents: number,
) {
  const isGerman = payload.locale === "de";
  const yesNo = isGerman ? { yes: "Ja", no: "Nein" } : { yes: "Yes", no: "No" };
  const period = `${payload.periodFrom} - ${payload.periodTo}`;
  const location = rentalLocationLabels[payload.locale][payload.location];
  const affiliateLine = payload.affiliateKey ? `Affiliate-Key: ${payload.affiliateKey}` : null;
  const bikeDetails = payload.bikes.flatMap((bike, index) => {
    const pedalLabel = bike.needsPedals
      ? (pedalTypeLabels[payload.locale][bike.pedalType as keyof typeof pedalTypeLabels.de] ?? bike.pedalType)
      : yesNo.no;
    const mountLabel = bike.needsComputerMount
      ? (computerMountTypeLabels[payload.locale][bike.computerMountType as keyof typeof computerMountTypeLabels.de] ??
        bike.computerMountType)
      : yesNo.no;

    return [
      `Bike ${index + 1}`,
      `${isGerman ? "Körpergröße" : "Height"}: ${bike.height} cm`,
      `${isGerman ? "Rennrad" : "Road bike"}: ${bike.bikeSize}`,
      `${isGerman ? "Pedale" : "Pedals"}: ${bike.needsPedals ? `${yesNo.yes}, ${pedalLabel}` : yesNo.no}`,
      `${isGerman ? "Fahrradcomputerhalterung" : "Bike computer mount"}: ${bike.needsComputerMount ? `${yesNo.yes}, ${mountLabel}` : yesNo.no}`,
      `${isGerman ? "Helm" : "Helmet"}: ${bike.needsHelmet ? yesNo.yes : yesNo.no}`,
      `${isGerman ? "Kleidung" : "Clothing"}: ${bike.needsClothing ? yesNo.yes : yesNo.no}`,
      "",
    ];
  });

  return [
    isGerman ? "Neue Bike-Anfrage" : "New bike inquiry",
    "",
    `${isGerman ? "Auftragsnummer" : "Order number"}: ${orderNumber}`,
    `${isGerman ? "Name" : "Name"}: ${payload.name}`,
    `${isGerman ? "Kontakt" : "Contact"}: ${payload.contact}`,
    `${isGerman ? "Telefon" : "Phone"}: ${payload.phone}`,
    `${isGerman ? "Standort" : "Location"}: ${location}`,
    `${isGerman ? "Anzahl Bikes" : "Number of bikes"}: ${payload.bikes.length}`,
    `${isGerman ? "Zeitraum" : "Rental period"}: ${period}`,
    `${isGerman ? "Abholuhrzeit" : "Pickup time"}: ${payload.pickupTime}`,
    `${isGerman ? "Abgabeuhrzeit" : "Drop-off time"}: ${payload.dropoffTime}`,
    `${isGerman ? "Gesamtpreis" : "Total price"}: ${formatPrice(totalPriceCents, payload.locale)}`,
    "",
    isGerman ? "Bike-Details:" : "Bike details:",
    ...bikeDetails,
    affiliateLine,
    "",
    isGerman ? "Nachricht:" : "Message:",
    payload.message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const parsed = await parseInquiryRequest(request, "contact", contactInquirySchema);
    if ("error" in parsed) return parsed.error;

    const orderNumber = createOrderNumber();
    const { locale, bikeTitle, contact, bikes } = parsed.data;
    const database = getDatabase();
    if (!isRequestAvailable(database, parsed.data.location, bikes)) {
      return jsonError(400, "validation_error", "Requested bike or equipment is unavailable at this location");
    }
    const totalPriceCents = calculateInquiryPrice(
      getLocationInventory(database, parsed.data.location),
      parsed.data,
    ).totalCents;
    const bikeCountLabel =
      bikes.length === 1 ? (locale === "de" ? "Bike" : "bike") : locale === "de" ? "Bikes" : "bikes";
    const subject =
      locale === "de"
        ? bikeTitle
          ? `Neue Bike-Anfrage ${orderNumber} - ${bikeTitle} (${bikes.length} ${bikeCountLabel})`
          : `Neue Bike-Anfrage ${orderNumber} (${bikes.length} ${bikeCountLabel})`
        : bikeTitle
          ? `New bike inquiry ${orderNumber} - ${bikeTitle} (${bikes.length} ${bikeCountLabel})`
          : `New bike inquiry ${orderNumber} (${bikes.length} ${bikeCountLabel})`;
    let sent;
    try {
      sent = await sendInquiryMail({
        subject,
        text: createMailBody(parsed.data, orderNumber, totalPriceCents),
        replyTo: contact,
      });
    } catch {
      return jsonError(500, "send_failed", "Unable to send message");
    }

    if (!sent) {
      return jsonError(500, "config_incomplete", "Mail configuration is incomplete");
    }

    saveRentalInquiry(
      database,
      parsed.data,
      orderNumber,
      totalPriceCents,
      new Date(),
      "unanswered",
      "automatic",
      sent.messageId,
    );
    return NextResponse.json({ ok: true, orderNumber, totalPriceCents }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
