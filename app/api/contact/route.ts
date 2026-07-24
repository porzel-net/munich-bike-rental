import { NextResponse } from "next/server";

import { computerMountTypeLabels, pedalTypeLabels, rentalLocationLabels } from "../../../lib/inquiries/catalog";
import { contactInquirySchema } from "../../../lib/inquiries/schemas";
import { createOrderNumber, jsonError, parseInquiryRequest, sendInquiryMail } from "../../../lib/inquiries/server";

export const runtime = "nodejs";

function createMailBody(payload: Awaited<ReturnType<typeof contactInquirySchema.parse>>, orderNumber: string) {
  const isGerman = payload.locale === "de";
  const yesNo = isGerman ? { yes: "Ja", no: "Nein" } : { yes: "Yes", no: "No" };
  const period = `${payload.periodFrom} - ${payload.periodTo}`;
  const location = rentalLocationLabels[payload.locale][payload.location];
  const affiliateLine = payload.affiliateKey ? `Affiliate-Key: ${payload.affiliateKey}` : null;
  const bikeDetails = payload.bikes.flatMap((bike, index) => {
    const pedalLabel = bike.needsPedals
      ? pedalTypeLabels[payload.locale][bike.pedalType as keyof typeof pedalTypeLabels.de]
      : yesNo.no;
    const mountLabel = bike.needsComputerMount
      ? computerMountTypeLabels[payload.locale][bike.computerMountType as keyof typeof computerMountTypeLabels.de]
      : yesNo.no;

    return [
      `Bike ${index + 1}`,
      `${isGerman ? "Körpergröße" : "Height"}: ${bike.height} cm`,
      `${isGerman ? "Rennrad" : "Road bike"}: ${bike.bikeSize}`,
      `${isGerman ? "Pedale" : "Pedals"}: ${bike.needsPedals ? `${yesNo.yes}, ${pedalLabel}` : yesNo.no}`,
      `${isGerman ? "Fahrradcomputerhalterung" : "Bike computer mount"}: ${bike.needsComputerMount ? `${yesNo.yes}, ${mountLabel}` : yesNo.no}`,
      `${isGerman ? "Helm" : "Helmet"}: ${bike.needsHelmet ? yesNo.yes : yesNo.no}`,
      `${isGerman ? "Kleidung" : "Clothing"}: ${bike.needsClothing ? yesNo.yes : yesNo.no}`,
      `${isGerman ? "Bikepackingtasche" : "Bikepacking bag"}: ${bike.needsBikepackingBag ? yesNo.yes : yesNo.no}`,
      `${isGerman ? "Flaschenhalter" : "Bottle holder"}: ${bike.bottleHolderIncluded ? (isGerman ? "Inklusive" : "Included") : yesNo.no}`,
      `${isGerman ? "Reparaturset" : "Repair kit"}: ${bike.repairKitIncluded ? (isGerman ? "Inklusive" : "Included") : yesNo.no}`,
      `${isGerman ? "Rennradbrille" : "Road cycling glasses"}: ${bike.needsGlasses ? yesNo.yes : yesNo.no}`,
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
    const sent = await sendInquiryMail({
      subject,
      text: createMailBody(parsed.data, orderNumber),
      replyTo: contact,
    });

    if (!sent) return jsonError(500, "config_incomplete", "Mail configuration is incomplete");
    return NextResponse.json({ ok: true, orderNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
