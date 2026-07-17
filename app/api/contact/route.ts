import { NextResponse } from "next/server";

import { computerMountTypeLabels, pedalTypeLabels, rentalLocationLabels } from "../../../lib/inquiries/catalog";
import { contactInquirySchema } from "../../../lib/inquiries/schemas";
import { createOrderNumber, jsonError, parseInquiryRequest, sendInquiryMail } from "../../../lib/inquiries/server";

export const runtime = "nodejs";

function createMailBody(payload: Awaited<ReturnType<typeof contactInquirySchema.parse>>, orderNumber: string) {
  const isGerman = payload.locale === "de";
  const yesNo = isGerman ? { yes: "Ja", no: "Nein" } : { yes: "Yes", no: "No" };
  const period = `${payload.periodFrom} - ${payload.periodTo}`;
  const pedalLabel = payload.needsPedals
    ? pedalTypeLabels[payload.locale][payload.pedalType as keyof typeof pedalTypeLabels.de]
    : yesNo.no;
  const mountLabel = payload.needsComputerMount
    ? computerMountTypeLabels[payload.locale][payload.computerMountType as keyof typeof computerMountTypeLabels.de]
    : yesNo.no;
  const location = rentalLocationLabels[payload.locale][payload.location];
  const affiliateLine = payload.affiliateKey ? `Affiliate-Key: ${payload.affiliateKey}` : null;

  return [
    isGerman ? "Neue Bike-Anfrage" : "New bike inquiry",
    "",
    `${isGerman ? "Auftragsnummer" : "Order number"}: ${orderNumber}`,
    `${isGerman ? "Name" : "Name"}: ${payload.name}`,
    `${isGerman ? "Kontakt" : "Contact"}: ${payload.contact}`,
    `${isGerman ? "Telefon" : "Phone"}: ${payload.phone}`,
    `${isGerman ? "Körpergröße" : "Height"}: ${payload.height}`,
    `${isGerman ? "Standort" : "Location"}: ${location}`,
    `${isGerman ? "Rennrad" : "Road bike"}: ${payload.bikeSize}`,
    `${isGerman ? "Zeitraum" : "Rental period"}: ${period}`,
    `${isGerman ? "Abholuhrzeit" : "Pickup time"}: ${payload.pickupTime}`,
    `${isGerman ? "Abgabeuhrzeit" : "Drop-off time"}: ${payload.dropoffTime}`,
    `${isGerman ? "Pedale" : "Pedals"}: ${payload.needsPedals ? `${yesNo.yes}, ${pedalLabel}` : yesNo.no}`,
    `${isGerman ? "Fahrradcomputerhalterung" : "Bike computer mount"}: ${payload.needsComputerMount ? `${yesNo.yes}, ${mountLabel}` : yesNo.no}`,
    `${isGerman ? "Helm" : "Helmet"}: ${payload.needsHelmet ? yesNo.yes : yesNo.no}`,
    `${isGerman ? "Kleidung" : "Clothing"}: ${payload.needsClothing ? yesNo.yes : yesNo.no}`,
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
    const { locale, bikeTitle, contact } = parsed.data;
    const subject =
      locale === "de"
        ? bikeTitle
          ? `Neue Bike-Anfrage ${orderNumber} - ${bikeTitle}`
          : `Neue Bike-Anfrage ${orderNumber}`
        : bikeTitle
          ? `New bike inquiry ${orderNumber} - ${bikeTitle}`
          : `New bike inquiry ${orderNumber}`;
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
