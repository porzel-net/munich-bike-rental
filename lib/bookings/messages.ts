import { formatEuro } from "./money";
import {
  computerMountTypeLabels,
  pedalTypeLabels,
  rentalLocationLabels,
  type RentalLocation,
} from "../inquiries/catalog";
import { rentalLocationConfigs } from "../rental-locations";
import type { OfferAccessorySelection } from "./quotes";

export type OfferMailInput = {
  locale: "de" | "en";
  alternative: boolean;
  name: string;
  email?: string;
  phone?: string;
  customerMessage?: string;
  orderNumber: string;
  requested: Array<{
    requestedLabel: string;
    heightCm?: number;
    assetName: string;
    accessories?: OfferAccessorySelection;
  }>;
  totalCents: number;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  location: string;
  token: string;
  senderFirstName: string;
  alternativeReason?: string;
};

function bookingPageUrl(token: string) {
  const origin = (process.env.APP_ORIGIN ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/angebot/${encodeURIComponent(token)}`;
}

export function renderOfferMail(input: OfferMailInput) {
  const de = input.locale === "de";
  const items = input.requested
    .map((item) => {
      const bikeName =
        input.alternative && item.requestedLabel !== item.assetName
          ? `${item.requestedLabel} → ${item.assetName}`
          : item.assetName;
      const bikeHeading = item.heightCm ? `${bikeName} (${item.heightCm} cm)` : bikeName;
      if (!item.accessories) return bikeHeading;
      const accessories = item.accessories;
      const lines = de
        ? [
            `Pedale: ${accessories.needsPedals ? (pedalTypeLabels.de[accessories.pedalType as keyof typeof pedalTypeLabels.de] ?? accessories.pedalType ?? "Enthalten") : "Nicht enthalten"}`,
            `Computerhalterung: ${accessories.needsComputerMount ? (computerMountTypeLabels.de[accessories.computerMountType as keyof typeof computerMountTypeLabels.de] ?? accessories.computerMountType ?? "Enthalten") : "Nicht enthalten"}`,
            `Helm: ${accessories.needsHelmet ? "Enthalten" : "Nicht enthalten"}`,
            `Kleidung: ${accessories.needsClothing ? "Enthalten" : "Nicht enthalten"}`,
          ]
        : [
            `Pedals: ${accessories.needsPedals ? (pedalTypeLabels.en[accessories.pedalType as keyof typeof pedalTypeLabels.en] ?? accessories.pedalType ?? "Included") : "Not included"}`,
            `Computer mount: ${accessories.needsComputerMount ? (computerMountTypeLabels.en[accessories.computerMountType as keyof typeof computerMountTypeLabels.en] ?? accessories.computerMountType ?? "Included") : "Not included"}`,
            `Helmet: ${accessories.needsHelmet ? "Included" : "Not included"}`,
            `Clothing: ${accessories.needsClothing ? "Included" : "Not included"}`,
          ];
      return [bikeHeading, de ? "Zubehör:" : "Equipment:", ...lines.map((line) => `- ${line}`)].join("\n");
    })
    .join("\n");
  const greeting = input.name.trim().split(/\s+/)[0] || input.name;
  const pickupAddress =
    rentalLocationConfigs.find((location) => location.key === input.location)?.address ?? input.location;
  const subject = de
    ? `${input.alternative ? "Alternativangebot" : "Angebot"} ${input.orderNumber}`
    : `${input.alternative ? "Alternative offer" : "Offer"} ${input.orderNumber}`;
  const text = de
    ? [
        `Hallo ${greeting},`,
        "",
        input.alternative
          ? `das ursprünglich gewünschte Fahrrad können wir für deinen Zeitraum leider nicht anbieten. Wir können dir stattdessen Folgendes anbieten.${input.alternativeReason ? `\n\nGrund für die Änderung: ${input.alternativeReason}` : ""}`
          : "wir können dir folgendes Angebot machen:",
        "",
        `Auftragsnummer: ${input.orderNumber}`,
        `Name: ${input.name}`,
        ...(input.email ? [`E-Mail: ${input.email}`] : []),
        ...(input.phone ? [`Telefon: ${input.phone}`] : []),
        `Standort: ${rentalLocationLabels.de[input.location as RentalLocation] ?? input.location}`,
        items,
        "",
        `Zeitraum: ${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
        `Gesamtpreis: ${formatEuro(input.totalCents, "de")}`,
        "",
        "Dieses Angebot reserviert das Fahrrad für dich für 36 Stunden.",
        "",
        "Bitte bestätige mit einem Klick auf den Link hier:",
        bookingPageUrl(input.token),
        "",
        "WICHTIG:",
        "Damit wir das Fahrrad verbindlich für dich reservieren können, bezahle bitte 100 % des Gesamtpreises über Stripe.",
        "",
        "Klicke dazu auf den Buchungslink und anschließend auf „100 % bezahlen & verbindlich buchen“. Stripe öffnet danach die sichere Zahlungsseite.",
        "",
        "Nach erfolgreicher Zahlung wird deine Buchung automatisch verbindlich bestätigt.",
        ...(input.customerMessage ? ["", `Deine Nachricht: ${input.customerMessage}`] : []),
        "",
        "Deine Checkliste für die Abholung:",
        "- Bestätigungslink drücken",
        "- 100 % des Gesamtbetrags über Stripe bezahlen",
        "- Kaution von 100 € in bar mitbringen",
        "- Personalausweis mitbringen",
        `- Zur Abholung: ${pickupAddress}`,
        "- Plane genug Zeit ein, um pünktlich zu sein, dann hast du mehr vom Bike ;)",
        "",
        "Liebe Grüße,",
        input.senderFirstName,
      ].join("\n")
    : [
        `Hello ${greeting},`,
        "",
        input.alternative
          ? `Unfortunately, the bike you requested is not available for your dates. We can offer the following alternative.${input.alternativeReason ? `\n\nReason for the change: ${input.alternativeReason}` : ""}`
          : "We can offer you the following:",
        "",
        `Order number: ${input.orderNumber}`,
        `Name: ${input.name}`,
        ...(input.email ? [`Email: ${input.email}`] : []),
        ...(input.phone ? [`Phone: ${input.phone}`] : []),
        `Location: ${rentalLocationLabels.en[input.location as RentalLocation] ?? input.location}`,
        items,
        "",
        `Rental period: ${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
        `Total price: ${formatEuro(input.totalCents, "en")}`,
        "",
        "This offer reserves the bike for you for 36 hours.",
        "",
        "Please confirm by clicking the link here:",
        bookingPageUrl(input.token),
        "",
        "IMPORTANT:",
        "To reserve the bike bindingly, please pay 100% of the total price through Stripe.",
        "",
        "Click the booking link and then choose ‘Pay 100% & book bindingly’. Stripe will open its secure payment page.",
        "",
        "After successful payment, your booking is automatically confirmed bindingly.",
        ...(input.customerMessage ? ["", `Your message: ${input.customerMessage}`] : []),
        "",
        "Your pickup checklist:",
        "- Click the confirmation link",
        "- Pay 100% of the total through Stripe",
        "- Bring the €100 deposit in cash",
        "- Bring your ID card or passport",
        `- Pickup address: ${pickupAddress}`,
        "- Plan enough time to arrive punctually so you can enjoy more of the bike ;)",
        "",
        "Kind regards,",
        input.senderFirstName,
      ].join("\n");
  return { subject, text };
}

export function renderInquiryReceivedMail(input: {
  locale: "de" | "en";
  name: string;
  email: string;
  phone: string;
  orderNumber: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  customerMessage: string;
  requested: Array<{
    requestedLabel: string;
    heightCm: number;
    accessories: OfferAccessorySelection;
  }>;
  totalCents: number;
  publicLinkToken: string;
}) {
  const de = input.locale === "de";
  const greeting = input.name.trim().split(/\s+/)[0] || input.name;
  const formatAccessories = (item: (typeof input.requested)[number]) => {
    const accessories = item.accessories;
    return de
      ? [
          `Pedale: ${accessories.needsPedals ? (accessories.pedalType ?? "Ja") : "Nein"}`,
          `Computerhalterung: ${accessories.needsComputerMount ? (accessories.computerMountType ?? "Ja") : "Nein"}`,
          `Helm: ${accessories.needsHelmet ? "Ja" : "Nein"}`,
          `Kleidung: ${accessories.needsClothing ? "Ja" : "Nein"}`,
        ]
      : [
          `Pedals: ${accessories.needsPedals ? (accessories.pedalType ?? "Yes") : "No"}`,
          `Computer mount: ${accessories.needsComputerMount ? (accessories.computerMountType ?? "Yes") : "No"}`,
          `Helmet: ${accessories.needsHelmet ? "Yes" : "No"}`,
          `Clothing: ${accessories.needsClothing ? "Yes" : "No"}`,
        ];
  };
  const bikes = input.requested.flatMap((item, index) => [
    `${de ? "Fahrrad" : "Bike"} ${index + 1}: ${item.requestedLabel}`,
    `${de ? "Körpergröße" : "Height"}: ${item.heightCm} cm`,
    ...formatAccessories(item),
    "",
  ]);
  const subject = de ? `Anfrage erhalten ${input.orderNumber}` : `Inquiry received ${input.orderNumber}`;
  const text = [
    de ? `Hallo ${greeting},` : `Hello ${greeting},`,
    "",
    de
      ? "vielen Dank für deine Anfrage. Wir haben alle Daten erhalten und prüfen nun die Verfügbarkeit. Sobald wir dein konkretes Angebot vorbereitet haben, bekommst du eine weitere E-Mail mit allen Details und einem Link zur verbindlichen Buchung."
      : "Thank you for your inquiry. We received all details and will now check availability. As soon as your concrete offer is ready, you will receive another email with all details and a link to confirm the booking bindingly.",
    "",
    `${de ? "Auftragsnummer" : "Order number"}: ${input.orderNumber}`,
    `${de ? "Name" : "Name"}: ${input.name}`,
    `${de ? "E-Mail" : "Email"}: ${input.email}`,
    `${de ? "Telefon" : "Phone"}: ${input.phone}`,
    `${de ? "Standort" : "Location"}: ${rentalLocationLabels[input.locale][input.location as RentalLocation] ?? input.location}`,
    `${de ? "Zeitraum" : "Rental period"}: ${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
    `${de ? "Vorläufige Preisschätzung" : "Initial price estimate"}: ${formatEuro(input.totalCents, input.locale)}`,
    "",
    de ? "Angefragte Fahrräder:" : "Requested bikes:",
    ...bikes,
    ...(input.customerMessage ? [de ? "Nachricht:" : "Message:", input.customerMessage, ""] : []),
    "",
    de
      ? "Dein aktueller Buchungsstand und alle Daten sind jederzeit über diesen Link abrufbar:"
      : "Your current booking status and all details are always available via this link:",
    de
      ? "Status: Anfrage eingegangen – wir prüfen jetzt die Verfügbarkeit."
      : "Status: Inquiry received – we are checking availability.",
    bookingPageUrl(input.publicLinkToken),
    "",
    de ? "Viele Grüße\nMunich Bike Rental" : "Kind regards\nMunich Bike Rental",
  ].join("\n");
  return { subject, text };
}

export function renderBookingNotice(input: {
  kind: "confirmed" | "cancelled" | "rejected";
  locale: "de" | "en";
  name: string;
  orderNumber: string;
  cancellationFeeCents?: number;
  senderFirstName?: string;
}) {
  const de = input.locale === "de";
  const recipientFirstName = input.name.trim().split(/\s+/)[0] || input.name;
  const senderFirstName = input.senderFirstName ?? "Munich Bike Rental";
  const text =
    input.kind === "confirmed"
      ? de
        ? `Hallo ${input.name},\n\ndeine Buchung ${input.orderNumber} ist verbindlich bestätigt.\n\nViele Grüße\nMunich Bike Rental`
        : `Hello ${input.name},\n\nyour booking ${input.orderNumber} is now confirmed.\n\nKind regards\nMunich Bike Rental`
      : input.kind === "cancelled"
        ? de
          ? `Hallo ${input.name},\n\ndeine Buchung ${input.orderNumber} wurde storniert.${input.cancellationFeeCents ? ` Die Stornogebühr beträgt ${formatEuro(input.cancellationFeeCents, "de")}.` : ""}\n\nViele Grüße\nMunich Bike Rental`
          : `Hello ${input.name},\n\nyour booking ${input.orderNumber} has been cancelled.${input.cancellationFeeCents ? ` The cancellation fee is ${formatEuro(input.cancellationFeeCents, "en")}.` : ""}\n\nKind regards\nMunich Bike Rental`
        : de
          ? `Hey ${recipientFirstName},\n\nvielen Dank für deine Anfrage.\n\nLeider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!\n\nWir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt.\n\nLiebe Grüße\n${senderFirstName}`
          : `Hello ${recipientFirstName},\n\nthank you for your inquiry.\n\nUnfortunately, we cannot offer you a suitable bike for this period.\n\nWe hope you find what you are looking for and wish you a good ride.\n\nKind regards\n${senderFirstName}`;
  const subjects = {
    confirmed: de ? `Buchung bestätigt ${input.orderNumber}` : `Booking confirmed ${input.orderNumber}`,
    cancelled: de ? `Stornierung ${input.orderNumber}` : `Cancellation ${input.orderNumber}`,
    rejected: de ? `Anfrage ${input.orderNumber}` : `Inquiry ${input.orderNumber}`,
  };
  return { subject: subjects[input.kind], text };
}
