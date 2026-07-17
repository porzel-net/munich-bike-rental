import { NextResponse } from "next/server";

import { maintenanceServiceTypes } from "../../../lib/inquiries/catalog";
import { maintenanceInquirySchema } from "../../../lib/inquiries/schemas";
import { createOrderNumber, jsonError, parseInquiryRequest, sendInquiryMail } from "../../../lib/inquiries/server";

export const runtime = "nodejs";

const serviceLabels = {
  de: {
    wax: "Öl auf Wachs mit Beratung",
    cleaning: "Kettenpflege und Antriebsreinigung",
    parts: "Teile tauschen",
    repair: "Reparatur",
    advice: "Beratung",
  },
  en: {
    wax: "Oil-to-wax with advice",
    cleaning: "Chain care and drivetrain cleaning",
    parts: "Part replacement",
    repair: "Repair",
    advice: "Advice",
  },
} as const satisfies Record<"de" | "en", Record<(typeof maintenanceServiceTypes)[number], string>>;

function createMailBody(payload: Awaited<ReturnType<typeof maintenanceInquirySchema.parse>>, orderNumber: string) {
  const isGerman = payload.locale === "de";
  const pickup = payload.pickup
    ? isGerman
      ? "Ja, bitte abholen und zurückbringen"
      : "Yes, please pick up and return"
    : isGerman
      ? "Nein"
      : "No";

  return [
    isGerman ? "Neue Wartungsanfrage" : "New maintenance inquiry",
    "",
    `${isGerman ? "Auftragsnummer" : "Order number"}: ${orderNumber}`,
    `${isGerman ? "Name" : "Name"}: ${payload.name}`,
    `${isGerman ? "Kontakt" : "Contact"}: ${payload.contact}`,
    `${isGerman ? "Radmodell / Teile" : "Bike model / parts"}: ${payload.bikeModel}`,
    `${isGerman ? "Wunsch" : "Need"}: ${serviceLabels[payload.locale][payload.serviceType]}`,
    `${isGerman ? "Abholung" : "Pickup"}: ${pickup}`,
    "",
    isGerman ? "Nachricht:" : "Message:",
    payload.message,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const parsed = await parseInquiryRequest(request, "maintenance", maintenanceInquirySchema);
    if ("error" in parsed) return parsed.error;

    const orderNumber = createOrderNumber();
    const subject =
      parsed.data.locale === "de" ? `Neue Wartungsanfrage ${orderNumber}` : `New maintenance inquiry ${orderNumber}`;
    const sent = await sendInquiryMail({
      subject,
      text: createMailBody(parsed.data, orderNumber),
      replyTo: parsed.data.contact,
    });

    if (!sent) return jsonError(500, "config_incomplete", "Mail configuration is incomplete");
    return NextResponse.json({ ok: true, orderNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
