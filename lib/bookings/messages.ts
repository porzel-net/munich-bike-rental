import { formatEuro } from "./money";
import {
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  rentalLocationLabels,
  type RentalLocation,
} from "../inquiries/catalog";
import { rentalLocationConfigs } from "../rental-locations";
import { siteConfig } from "../site";
import { feedbackCriteria, feedbackPageUrl } from "./feedback";
import { emailCard, emailLabel, emailParagraph, escapeHtml, renderEmailLayout } from "../inquiries/email-template";
import type { OfferAccessorySelection } from "./quotes";

export type RenderedMail = { subject: string; text: string; html: string };

export type BookingInformationChange = {
  labelDe: string;
  labelEn: string;
  previous: string;
  current: string;
};

export type OfferMailInput = {
  locale: "de" | "en";
  alternative: boolean;
  name: string;
  email?: string;
  phone?: string;
  customerMessage?: string;
  personalMessage?: string;
  orderNumber: string;
  requested: Array<{
    requestedLabel: string;
    heightCm?: number;
    assetName: string;
    frameNumber?: string | null;
    dailyPriceCents?: number;
    weekdayPriceCents?: number;
    weekendPriceCents?: number;
    accessories?: OfferAccessorySelection;
  }>;
  totalCents: number;
  calculatedTotalCents?: number;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  location: string;
  pickupAddress?: string;
  token: string;
  senderFirstName: string;
  alternativeReason?: string;
};

function bookingPageUrl(token: string) {
  const origin = siteConfig.url.replace(/\/$/, "");
  return `${origin}/angebot/${encodeURIComponent(token)}`;
}

function cancellationPeriodLabel(period: string | undefined, locale: "de" | "en") {
  if (!period) return undefined;
  const labels = {
    more_than_7_days: { de: "mehr als 7 Tage vor Mietbeginn", en: "more than 7 days before rental" },
    between_7_days_and_24_hours: { de: "7 Tage bis 24 Stunden vor Mietbeginn", en: "7 days to 24 hours before rental" },
    less_than_24_hours: { de: "innerhalb von 24 Stunden vor Mietbeginn", en: "within 24 hours before rental" },
  } as const;
  return labels[period as keyof typeof labels]?.[locale] ?? period;
}

function cancellationPolicyDescription(period: string | undefined, locale: "de" | "en") {
  const descriptions = {
    more_than_7_days: { de: "25 % Stornogebühr / 75 % Rückerstattung", en: "25% cancellation fee / 75% refund" },
    between_7_days_and_24_hours: {
      de: "50 % Stornogebühr / 50 % Rückerstattung",
      en: "50% cancellation fee / 50% refund",
    },
    less_than_24_hours: { de: "100 % Stornogebühr / keine Rückerstattung", en: "100% cancellation fee / no refund" },
  } as const;
  return descriptions[period as keyof typeof descriptions]?.[locale];
}

export function renderOfferMail(input: OfferMailInput) {
  const de = input.locale === "de";
  const offerItems = input.requested.map((item) => {
    const bikeName =
      input.alternative && item.requestedLabel !== item.assetName
        ? `${item.requestedLabel} → ${item.assetName}`
        : item.assetName;
    const bikeHeading = item.heightCm ? `${bikeName} (${item.heightCm} cm)` : bikeName;
    const frameLine = item.frameNumber?.trim()
      ? [de ? `Rahmennummer: ${item.frameNumber.trim()}` : `Frame number: ${item.frameNumber.trim()}`]
      : [];
    const weekdayPriceCents = item.weekdayPriceCents ?? item.dailyPriceCents;
    const weekendPriceCents = item.weekendPriceCents ?? item.dailyPriceCents;
    const priceLines = [
      weekdayPriceCents !== undefined
        ? `${de ? "Preis Mo-Fr" : "Mon-Fri price"}: ${formatEuro(weekdayPriceCents, input.locale)} / ${de ? "Tag" : "day"}`
        : null,
      weekendPriceCents !== undefined
        ? `${de ? "Preis Sa-So" : "Sat-Sun price"}: ${formatEuro(weekendPriceCents, input.locale)} / ${de ? "Tag" : "day"}`
        : null,
    ].filter((line): line is string => Boolean(line));
    if (!item.accessories) return { bikeHeading, frameLine, priceLines, accessories: [] as string[] };
    const accessories = item.accessories;
    const lines = de
      ? [
          `Pedale: ${accessories.needsPedals ? getPedalTypeLabel(accessories.pedalType, "de") || "Enthalten" : "Nicht enthalten"}`,
          `Computerhalterung: ${accessories.needsComputerMount ? getComputerMountTypeLabel(accessories.computerMountType, "de") || "Enthalten" : "Nicht enthalten"}`,
          `Helm: ${accessories.needsHelmet ? "Enthalten" : "Nicht enthalten"}`,
          `Kleidung: ${accessories.needsClothing ? "Enthalten" : "Nicht enthalten"}`,
          `Bikepackingtasche: ${accessories.needsBikepackingBag ? "Enthalten" : "Nicht enthalten"}`,
          `Rennradbrille: ${accessories.needsGlasses ? "Enthalten" : "Nicht enthalten"}`,
          `Flaschenhalter: ${accessories.bottleHolderIncluded !== false ? "Inklusive" : "Nicht enthalten"}`,
          `Reparaturset: ${accessories.repairKitIncluded !== false ? "Inklusive" : "Nicht enthalten"}`,
          `Versicherungsschutz: ${accessories.insuranceProtectionSelected !== false ? "Ja" : "Nein"}`,
        ]
      : [
          `Pedals: ${accessories.needsPedals ? getPedalTypeLabel(accessories.pedalType, "en") || "Included" : "Not included"}`,
          `Computer mount: ${accessories.needsComputerMount ? getComputerMountTypeLabel(accessories.computerMountType, "en") || "Included" : "Not included"}`,
          `Helmet: ${accessories.needsHelmet ? "Included" : "Not included"}`,
          `Clothing: ${accessories.needsClothing ? "Included" : "Not included"}`,
          `Bikepacking bag: ${accessories.needsBikepackingBag ? "Included" : "Not included"}`,
          `Road cycling glasses: ${accessories.needsGlasses ? "Included" : "Not included"}`,
          `Bottle holder: ${accessories.bottleHolderIncluded !== false ? "Included" : "Not included"}`,
          `Repair kit: ${accessories.repairKitIncluded !== false ? "Included" : "Not included"}`,
          `Insurance protection: ${accessories.insuranceProtectionSelected !== false ? "Yes" : "No"}`,
        ];
    return { bikeHeading, frameLine, priceLines, accessories: lines };
  });
  const items = offerItems
    .map(({ bikeHeading, frameLine, priceLines, accessories }) =>
      [
        bikeHeading,
        ...frameLine,
        ...priceLines,
        ...(accessories.length ? [de ? "Zubehör:" : "Equipment:", ...accessories.map((line) => `- ${line}`)] : []),
      ].join("\n"),
    )
    .join("\n");
  const depositTotalEuro = offerItems.length * 100;
  const greeting = input.name.trim().split(/\s+/)[0] || input.name;
  const pickupAddress =
    input.pickupAddress?.trim() ||
    rentalLocationConfigs.find((location) => location.key === input.location)?.address ||
    input.location;
  const pickupLocation = rentalLocationConfigs.find((location) => location.key === input.location);
  const pickupNote =
    pickupLocation && "pickupNote" in pickupLocation ? pickupLocation.pickupNote?.[input.locale] : undefined;
  const subject = de
    ? `${input.alternative ? "Alternativangebot" : "Angebot"} ${input.orderNumber}`
    : `${input.alternative ? "Alternative offer" : "Offer"} ${input.orderNumber}`;
  const alternativeIntro = de
    ? "das ursprünglich gewünschte Fahrrad können wir für deinen Zeitraum leider nicht anbieten. Wir können dir stattdessen Folgendes anbieten."
    : "Unfortunately, the bike you requested is not available for your dates. We can offer the following alternative.";
  const standardIntro = de ? "wir können dir folgendes Angebot machen:" : "We can offer you the following:";
  const personalMessage = input.personalMessage?.trim() ?? "";
  const text = de
    ? [
        `Hallo ${greeting},`,
        "",
        ...(personalMessage
          ? [personalMessage]
          : [
              input.alternative
                ? `${alternativeIntro}${input.alternativeReason ? `\n\nGrund für die Änderung: ${input.alternativeReason}` : ""}`
                : standardIntro,
            ]),
        ...(personalMessage && input.alternative && input.alternativeReason
          ? [`Grund für die Änderung: ${input.alternativeReason}`]
          : []),
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
        ...(input.calculatedTotalCents !== undefined
          ? ["Hinweis: Der Gesamtpreis wurde individuell vereinbart und weicht von der Standardberechnung ab."]
          : []),
        "",
        "Dieses Angebot bleibt 36 Stunden für dich reserviert. Danach verfällt die Reservierung automatisch.",
        "",
        "Wenn du das Angebot verbindlich buchen möchtest, öffne den Buchungslink und bezahle den Gesamtpreis über Stripe. Nach erfolgreicher Zahlung wird deine Buchung automatisch bestätigt:",
        bookingPageUrl(input.token),
        "",
        ...(input.customerMessage ? ["", `Deine Nachricht: ${input.customerMessage}`] : []),
        "",
        "Deine Checkliste für die Abholung:",
        "- Buchungsbestätigung öffnen",
        `- Kaution von 100 € pro Bike in bar mitbringen (also insgesamt ${depositTotalEuro} €)`,
        "- Personalausweis mitbringen",
        `- Zur Abholung: ${pickupAddress}`,
        ...(pickupNote ? [`- ${pickupNote}`] : []),
        "- Plane genug Zeit ein, um pünktlich zu sein, dann hast du mehr vom Bike ;)",
        "",
        "Liebe Grüße,",
        input.senderFirstName,
      ].join("\n")
    : [
        `Hello ${greeting},`,
        "",
        ...(personalMessage
          ? [personalMessage]
          : [
              input.alternative
                ? `${alternativeIntro}${input.alternativeReason ? `\n\nReason for the change: ${input.alternativeReason}` : ""}`
                : standardIntro,
            ]),
        ...(personalMessage && input.alternative && input.alternativeReason
          ? [`Reason for the change: ${input.alternativeReason}`]
          : []),
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
        ...(input.calculatedTotalCents !== undefined
          ? ["Note: The total price was agreed individually and differs from the standard calculation."]
          : []),
        "",
        "This offer remains reserved for you for 36 hours. After that, the reservation expires automatically.",
        "",
        "If you would like to book this offer, open the booking link and pay the total through Stripe. After successful payment, your booking is confirmed automatically:",
        bookingPageUrl(input.token),
        "",
        ...(input.customerMessage ? ["", `Your message: ${input.customerMessage}`] : []),
        "",
        "Your pickup checklist:",
        "- Open the booking confirmation",
        `- Bring the €100 deposit per bike in cash (€${depositTotalEuro} total)`,
        "- Bring your ID card or passport",
        `- Pickup address: ${pickupAddress}`,
        ...(pickupNote ? [`- ${pickupNote}`] : []),
        "- Plan enough time to arrive punctually so you can enjoy more of the bike ;)",
        "",
        "Kind regards,",
        input.senderFirstName,
      ].join("\n");
  const bikeCards = offerItems
    .map(({ bikeHeading, frameLine, priceLines, accessories }) => {
      const frameHtml = frameLine.length
        ? `<div style="margin-top:6px;color:#697177;font-size:13px">${escapeHtml(frameLine[0])}</div>`
        : "";
      const priceHtml = priceLines.length
        ? `<div style="margin-top:6px;color:#697177;font-size:13px;line-height:1.7">${priceLines.map((line) => escapeHtml(line)).join("<br />")}</div>`
        : "";
      const accessoryHtml = accessories.length
        ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e8eb">${emailLabel(de ? "Zubehör" : "Equipment")}<div style="color:#697177;font-size:13px;line-height:1.7">${accessories.map((line) => `✓ ${escapeHtml(line)}`).join("<br />")}</div></div>`
        : "";
      return emailCard(
        `<strong style="display:block;color:#171a1d;font-size:15px;line-height:1.4">${escapeHtml(bikeHeading)}</strong>${frameHtml}${priceHtml}${accessoryHtml}`,
        "#fbfcfd",
      );
    })
    .join("");
  const details = emailCard(
    `${emailLabel(de ? "Auftrag" : "Order")}<strong style="color:#171a1d;font-size:15px">${escapeHtml(input.orderNumber)}</strong><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:15px"><tr><td style="padding:0 12px 8px 0;color:#697177;font-size:13px;line-height:1.45">${emailLabel(de ? "Name" : "Name")}${escapeHtml(input.name)}</td><td style="padding:0 0 8px;color:#697177;font-size:13px;line-height:1.45">${emailLabel(de ? "Standort" : "Location")}${escapeHtml(rentalLocationLabels[input.locale][input.location as RentalLocation] ?? input.location)}</td></tr><tr><td style="padding:0 12px 0 0;color:#697177;font-size:13px;line-height:1.45">${emailLabel(de ? "Zeitraum" : "Rental period")}${escapeHtml(`${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`)}</td><td style="padding:0;color:#697177;font-size:13px;line-height:1.45">${emailLabel(de ? "Kontakt" : "Contact")}${escapeHtml(input.email)}${input.phone ? `<br />${escapeHtml(input.phone)}` : ""}</td></tr></table>`,
  );
  const checklist = de
    ? [
        "Buchungsbestätigung öffnen",
        `Kaution von 100 € pro Bike in bar mitbringen (also insgesamt ${depositTotalEuro} €)`,
        "Personalausweis mitbringen",
        `Zur Abholung: ${pickupAddress}`,
        ...(pickupNote ? [pickupNote] : []),
        "Plane genug Zeit ein, um pünktlich zu sein, dann hast du mehr vom Bike ;)",
      ]
    : [
        "Open the booking confirmation",
        `Bring the €100 deposit per bike in cash (€${depositTotalEuro} total)`,
        "Bring your ID card or passport",
        `Pickup address: ${pickupAddress}`,
        ...(pickupNote ? [pickupNote] : []),
        "Plan enough time to arrive punctually so you can enjoy more of the bike ;)",
      ];
  const customPriceNote =
    input.calculatedTotalCents !== undefined
      ? emailCard(
          `${emailLabel(de ? "Individuelle Preisvereinbarung" : "Individually agreed price")}${emailParagraph(
            de
              ? "Der Gesamtpreis wurde individuell mit dir vereinbart und weicht von der Standardberechnung ab."
              : "The total price was agreed individually and differs from the standard calculation.",
          )}`,
          "#fff7ed",
        )
      : "";
  const html = renderEmailLayout({
    locale: input.locale,
    preheader: `${subject} · ${formatEuro(input.totalCents, input.locale)}`,
    eyebrow: de ? "Dein Angebot" : "Your offer",
    title: de
      ? `Dein ${input.alternative ? "Alternativ " : "Bike-"}Angebot`
      : `Your ${input.alternative ? "alternative " : "bike "}offer`,
    intro: personalMessage || (input.alternative ? alternativeIntro : standardIntro),
    content: `${input.alternative && input.alternativeReason ? emailCard(`${emailLabel(de ? "Grund für die Änderung" : "Reason for the change")}${emailParagraph(input.alternativeReason)}`, "#eef2ff") : ""}${details}<div style="margin:26px 0 0">${emailLabel(de ? "Für dich reserviert" : "Reserved for you")}${bikeCards}</div><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:22px 0 18px"><tr><td style="color:#697177;font-size:13px">${escapeHtml(de ? "Gesamtpreis" : "Total price")}</td><td align="right" style="color:#171a1d;font-size:24px;font-weight:800;letter-spacing:-.03em">${escapeHtml(formatEuro(input.totalCents, input.locale))}</td></tr></table>${customPriceNote}${emailCard(`<strong style="display:block;margin-bottom:8px;color:#171a1d;font-size:14px">${escapeHtml(de ? "Nächster Schritt" : "Next step")}</strong>${emailParagraph(de ? "Dieses Angebot bleibt 36 Stunden für dich reserviert. Wenn du es verbindlich buchen möchtest, öffne den Buchungslink und bezahle den Gesamtpreis über Stripe. Nach erfolgreicher Zahlung wird deine Buchung automatisch bestätigt." : "This offer remains reserved for you for 36 hours. If you would like to book it, open the booking link and pay the total through Stripe. After successful payment, your booking is confirmed automatically.")}`, "#eef2ff")}${input.customerMessage ? emailCard(`${emailLabel(de ? "Deine Nachricht" : "Your message")}${emailParagraph(input.customerMessage)}`) : ""}<div style="margin-top:23px">${emailLabel(de ? "Checkliste für die Abholung" : "Pickup checklist")}<ul style="margin:0;padding:0 0 0 19px;color:#4f5960;font-size:13px;line-height:1.8">${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`,
    cta: { label: de ? "Angebot öffnen" : "Open offer", href: bookingPageUrl(input.token) },
  });
  return { subject, text, html };
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
          `Pedale: ${accessories.needsPedals ? getPedalTypeLabel(accessories.pedalType, "de") || "Enthalten" : "Nicht enthalten"}`,
          `Computerhalterung: ${accessories.needsComputerMount ? getComputerMountTypeLabel(accessories.computerMountType, "de") || "Enthalten" : "Nicht enthalten"}`,
          `Helm: ${accessories.needsHelmet ? "Ja" : "Nein"}`,
          `Kleidung: ${accessories.needsClothing ? "Ja" : "Nein"}`,
          `Bikepackingtasche: ${accessories.needsBikepackingBag ? "Ja" : "Nein"}`,
          `Rennradbrille: ${accessories.needsGlasses ? "Ja" : "Nein"}`,
          `Flaschenhalter: ${accessories.bottleHolderIncluded !== false ? "Inklusive" : "Nicht enthalten"}`,
          `Reparaturset: ${accessories.repairKitIncluded !== false ? "Inklusive" : "Nicht enthalten"}`,
          `Versicherungsschutz: ${accessories.insuranceProtectionSelected !== false ? "Ja" : "Nein"}`,
        ]
      : [
          `Pedals: ${accessories.needsPedals ? getPedalTypeLabel(accessories.pedalType, "en") || "Included" : "Not included"}`,
          `Computer mount: ${accessories.needsComputerMount ? getComputerMountTypeLabel(accessories.computerMountType, "en") || "Included" : "Not included"}`,
          `Helmet: ${accessories.needsHelmet ? "Yes" : "No"}`,
          `Clothing: ${accessories.needsClothing ? "Yes" : "No"}`,
          `Bikepacking bag: ${accessories.needsBikepackingBag ? "Yes" : "No"}`,
          `Road cycling glasses: ${accessories.needsGlasses ? "Yes" : "No"}`,
          `Bottle holder: ${accessories.bottleHolderIncluded !== false ? "Included" : "Not included"}`,
          `Repair kit: ${accessories.repairKitIncluded !== false ? "Included" : "Not included"}`,
          `Insurance protection: ${accessories.insuranceProtectionSelected !== false ? "Yes" : "No"}`,
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
    de ? "Viele Grüße\nYour Bike Rental" : "Kind regards\nYour Bike Rental",
  ].join("\n");
  const bikeCards = input.requested
    .map((item, index) => {
      const accessories = formatAccessories(item);
      return emailCard(
        `${emailLabel(`${de ? "Fahrrad" : "Bike"} ${index + 1}`)}<strong style="display:block;color:#171a1d;font-size:15px">${escapeHtml(item.requestedLabel)}</strong><div style="margin-top:7px;color:#697177;font-size:13px;line-height:1.7">${escapeHtml(`${de ? "Körpergröße" : "Height"}: ${item.heightCm} cm`)}<br />${accessories.map((line) => escapeHtml(line)).join("<br />")}</div>`,
        "#fbfcfd",
      );
    })
    .join("");
  const html = renderEmailLayout({
    locale: input.locale,
    preheader: subject,
    eyebrow: de ? "Anfrage erhalten" : "Inquiry received",
    title: de ? "Danke für deine Anfrage" : "Thanks for your inquiry",
    intro: de
      ? "Wir haben alle Daten erhalten und prüfen jetzt die Verfügbarkeit. Sobald dein konkretes Angebot bereit ist, bekommst du eine weitere E-Mail mit allen Details."
      : "We received all details and will now check availability. As soon as your concrete offer is ready, you will receive another email with all details.",
    content: `${emailCard(`${emailLabel(de ? "Auftrag" : "Order")}<strong style="color:#171a1d;font-size:15px">${escapeHtml(input.orderNumber)}</strong><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:15px"><tr><td style="padding:0 12px 8px 0;color:#697177;font-size:13px;line-height:1.5">${emailLabel(de ? "Name" : "Name")}${escapeHtml(input.name)}</td><td style="padding:0 0 8px;color:#697177;font-size:13px;line-height:1.5">${emailLabel(de ? "Standort" : "Location")}${escapeHtml(rentalLocationLabels[input.locale][input.location as RentalLocation] ?? input.location)}</td></tr><tr><td style="padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel(de ? "Zeitraum" : "Rental period")}${escapeHtml(`${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`)}</td><td style="color:#697177;font-size:13px;line-height:1.5">${emailLabel(de ? "Kontakt" : "Contact")}${escapeHtml(input.email)}<br />${escapeHtml(input.phone)}</td></tr></table>`)}<div style="margin-top:24px">${emailLabel(de ? "Angefragte Fahrräder" : "Requested bikes")}${bikeCards}</div>${input.customerMessage ? emailCard(`${emailLabel(de ? "Deine Nachricht" : "Your message")}${emailParagraph(input.customerMessage)}`) : ""}${emailCard(`<strong style="display:block;margin-bottom:8px;color:#171a1d;font-size:14px">${escapeHtml(de ? "Aktueller Status" : "Current status")}</strong>${emailParagraph(de ? "Anfrage eingegangen – wir prüfen jetzt die Verfügbarkeit." : "Inquiry received – we are checking availability.")}`, "#eef2ff")}`,
    cta: { label: de ? "Buchungsstatus öffnen" : "View booking status", href: bookingPageUrl(input.publicLinkToken) },
  });
  return { subject, text, html };
}

export function renderBookingNotice(input: {
  kind: "confirmed" | "cancelled" | "rejected";
  locale: "de" | "en";
  name: string;
  orderNumber: string;
  totalCents?: number;
  paidCents?: number;
  offerToken?: string;
  cancellationFeeCents?: number;
  refundCents?: number;
  cancellationReason?: string;
  cancellationPeriod?: string;
  senderFirstName?: string;
  personalMessage?: string;
  contactPhone?: string;
  bikes?: Array<{ name: string; frameNumber?: string | null }>;
}) {
  const de = input.locale === "de";
  const personalMessage = input.personalMessage?.trim() ?? "";
  const recipientFirstName = input.name.trim().split(/\s+/)[0] || input.name;
  const senderFirstName = input.senderFirstName ?? "Your Bike Rental";
  const offerLink = input.offerToken ? bookingPageUrl(input.offerToken) : null;
  const contactPhone = input.contactPhone?.trim() || siteConfig.phone;
  const contactText = de
    ? `Wenn du bei der Abholung angekommen bist oder kurzfristig Hilfe brauchst, ruf bitte deine zuständige Ansprechperson unter ${contactPhone} an.`
    : `When you arrive for pickup or need help at short notice, please call your assigned contact at ${contactPhone}.`;
  const bikeLines =
    input.bikes?.flatMap((bike, index) => [
      `${de ? "Fahrrad" : "Bike"} ${index + 1}: ${bike.name}`,
      ...(bike.frameNumber?.trim() ? [`${de ? "Rahmennummer" : "Frame number"}: ${bike.frameNumber.trim()}`] : []),
    ]) ?? [];
  const text =
    input.kind === "confirmed"
      ? de
        ? `Hallo ${input.name},\n\ndeine Buchung ${input.orderNumber} ist verbindlich bestätigt.${bikeLines.length ? `\n\n${bikeLines.join("\n")}` : ""}\n\n${contactText}${offerLink ? `\n\nAlle Informationen zu deiner Buchung findest du hier:\n${offerLink}` : ""}\n\nViele Grüße\nYour Bike Rental`
        : `Hello ${input.name},\n\nyour booking ${input.orderNumber} is now confirmed.${bikeLines.length ? `\n\n${bikeLines.join("\n")}` : ""}\n\n${contactText}${offerLink ? `\n\nYou can find all booking details here:\n${offerLink}` : ""}\n\nKind regards\nYour Bike Rental`
      : input.kind === "cancelled"
        ? de
          ? [
              `Hallo ${input.name},`,
              "",
              ...(input.personalMessage?.trim() ? [input.personalMessage.trim(), ""] : []),
              `deine Buchung ${input.orderNumber} wurde storniert.`,
              "",
              ...(input.cancellationReason ? [`Stornogrund: ${input.cancellationReason}`, ""] : []),
              ...(cancellationPeriodLabel(input.cancellationPeriod, "de")
                ? [`Stornierungszeitraum: ${cancellationPeriodLabel(input.cancellationPeriod, "de")}`, ""]
                : []),
              ...(cancellationPolicyDescription(input.cancellationPeriod, "de")
                ? [`Angewandte Regelung: ${cancellationPolicyDescription(input.cancellationPeriod, "de")}`, ""]
                : []),
              ...(input.totalCents !== undefined ? [`Buchungsbetrag: ${formatEuro(input.totalCents, "de")}`] : []),
              ...(input.paidCents !== undefined ? [`Bereits bezahlt: ${formatEuro(input.paidCents, "de")}`] : []),
              ...(input.cancellationFeeCents !== undefined
                ? [`Stornogebühr: ${formatEuro(input.cancellationFeeCents, "de")}`]
                : []),
              ...(input.refundCents !== undefined ? [`Rückerstattung: ${formatEuro(input.refundCents, "de")}`] : []),
              "",
              "Viele Grüße",
              "Your Bike Rental",
            ].join("\n")
          : [
              `Hello ${input.name},`,
              "",
              ...(input.personalMessage?.trim() ? [input.personalMessage.trim(), ""] : []),
              `your booking ${input.orderNumber} has been cancelled.`,
              "",
              ...(input.cancellationReason ? [`Cancellation reason: ${input.cancellationReason}`, ""] : []),
              ...(cancellationPeriodLabel(input.cancellationPeriod, "en")
                ? [`Cancellation period: ${cancellationPeriodLabel(input.cancellationPeriod, "en")}`, ""]
                : []),
              ...(cancellationPolicyDescription(input.cancellationPeriod, "en")
                ? [`Applied policy: ${cancellationPolicyDescription(input.cancellationPeriod, "en")}`, ""]
                : []),
              ...(input.totalCents !== undefined ? [`Booking amount: ${formatEuro(input.totalCents, "en")}`] : []),
              ...(input.paidCents !== undefined ? [`Already paid: ${formatEuro(input.paidCents, "en")}`] : []),
              ...(input.cancellationFeeCents !== undefined
                ? [`Cancellation fee: ${formatEuro(input.cancellationFeeCents, "en")}`]
                : []),
              ...(input.refundCents !== undefined
                ? [
                    `Refund: ${formatEuro(input.refundCents, "en")}`,
                    `You will receive ${formatEuro(input.refundCents, "en")} back.`,
                  ]
                : []),
              "",
              "Kind regards",
              "Your Bike Rental",
            ].join("\n")
        : de
          ? [
              `Hey ${recipientFirstName},`,
              "",
              ...(personalMessage
                ? [personalMessage]
                : [
                    "vielen Dank für deine Anfrage.",
                    "",
                    "Leider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!",
                    "",
                    "Wir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt.",
                  ]),
              "",
              "Liebe Grüße",
              senderFirstName,
            ].join("\n")
          : [
              `Hello ${recipientFirstName},`,
              "",
              ...(personalMessage
                ? [personalMessage]
                : [
                    "thank you for your inquiry.",
                    "",
                    "Unfortunately, we cannot offer you a suitable bike for this period.",
                    "",
                    "We hope you find what you are looking for and wish you a good ride.",
                  ]),
              "",
              "Kind regards",
              senderFirstName,
            ].join("\n");
  const subjects = {
    confirmed: de ? `Buchung bestätigt ${input.orderNumber}` : `Booking confirmed ${input.orderNumber}`,
    cancelled: de ? `Stornierung ${input.orderNumber}` : `Cancellation ${input.orderNumber}`,
    rejected: de ? `Anfrage ${input.orderNumber}` : `Inquiry ${input.orderNumber}`,
  };
  const subject = subjects[input.kind];
  const title =
    input.kind === "confirmed"
      ? de
        ? "Buchung bestätigt"
        : "Booking confirmed"
      : input.kind === "cancelled"
        ? de
          ? "Buchung storniert"
          : "Booking cancelled"
        : de
          ? "Danke für deine Anfrage"
          : "Thanks for your inquiry";
  const intro =
    input.kind === "confirmed"
      ? de
        ? `Deine Buchung ${input.orderNumber} ist verbindlich bestätigt.`
        : `Your booking ${input.orderNumber} is now confirmed.`
      : input.kind === "cancelled"
        ? de
          ? `Deine Buchung ${input.orderNumber} wurde storniert.`
          : `Your booking ${input.orderNumber} has been cancelled.`
        : de
          ? "Leider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!"
          : "Unfortunately, we cannot offer you a suitable bike for this period.";
  const noticeDetails = [
    input.kind === "cancelled" && input.totalCents !== undefined
      ? de
        ? `Buchungsbetrag: ${formatEuro(input.totalCents, "de")}`
        : `Booking amount: ${formatEuro(input.totalCents, "en")}`
      : "",
    input.kind === "cancelled" && input.paidCents !== undefined
      ? de
        ? `Bereits bezahlt: ${formatEuro(input.paidCents, "de")}`
        : `Already paid: ${formatEuro(input.paidCents, "en")}`
      : "",
    input.kind === "cancelled" && input.cancellationFeeCents !== undefined
      ? de
        ? `Stornogebühr: ${formatEuro(input.cancellationFeeCents, "de")}`
        : `Cancellation fee: ${formatEuro(input.cancellationFeeCents, "en")}`
      : "",
    input.kind === "cancelled" && input.refundCents !== undefined
      ? de
        ? `Rückerstattung: ${formatEuro(input.refundCents, "de")}`
        : `Refund: ${formatEuro(input.refundCents, "en")}`
      : "",
    input.kind === "cancelled" && input.cancellationReason
      ? de
        ? `Stornogrund: ${input.cancellationReason}`
        : `Cancellation reason: ${input.cancellationReason}`
      : "",
    input.kind === "cancelled" && input.cancellationPeriod
      ? de
        ? `Stornierungszeitraum: ${cancellationPeriodLabel(input.cancellationPeriod, "de")}`
        : `Cancellation period: ${cancellationPeriodLabel(input.cancellationPeriod, "en")}`
      : "",
    input.kind === "cancelled" && cancellationPolicyDescription(input.cancellationPeriod, input.locale)
      ? de
        ? `Angewandte Regelung: ${cancellationPolicyDescription(input.cancellationPeriod, "de")}`
        : `Applied policy: ${cancellationPolicyDescription(input.cancellationPeriod, "en")}`
      : "",
  ].filter(Boolean);
  const html = renderEmailLayout({
    locale: input.locale,
    preheader: subject,
    eyebrow:
      input.kind === "confirmed"
        ? de
          ? "Verbindlich"
          : "Confirmed"
        : input.kind === "cancelled"
          ? de
            ? "Storno"
            : "Cancellation"
          : de
            ? "Anfrage"
            : "Inquiry",
    title,
    intro: input.kind === "rejected" && personalMessage ? personalMessage : intro,
    content: `${noticeDetails.length ? emailCard(noticeDetails.map((detail) => `<p style="margin:0 0 6px;color:#4f5960;font-size:14px;line-height:1.5">${escapeHtml(detail)}</p>`).join("")) : ""}${input.kind === "confirmed" && bikeLines.length ? emailCard(`${emailLabel(de ? "Fahrräder" : "Bikes")}${bikeLines.map((line) => `<p style="margin:0 0 6px;color:#4f5960;font-size:14px;line-height:1.5">${escapeHtml(line)}</p>`).join("")}`) : ""}${input.kind === "confirmed" ? emailCard(`${emailLabel(de ? "Deine Ansprechperson" : "Your contact person")}${emailParagraph(contactText)}`, "#eef2ff") : ""}${input.kind === "confirmed" && offerLink ? emailCard(`${emailLabel(de ? "Deine Buchungsdetails" : "Your booking details")}${emailParagraph(de ? "Alle Informationen zu deiner Buchung findest du auf der Buchungsseite." : "You can find all booking details on the booking page.")}`, "#eef2ff") : ""}${input.kind === "rejected" && !personalMessage ? emailParagraph(de ? "Wir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt." : "We hope you find what you are looking for and wish you a good ride.") : ""}`,
    cta: offerLink ? { label: de ? "Buchungsdetails öffnen" : "Open booking details", href: offerLink } : undefined,
  });
  return { subject, text, html };
}

export function renderBookingInformationChangedMail(input: {
  locale: "de" | "en";
  name: string;
  orderNumber: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  bikes: string[];
  changes: BookingInformationChange[];
}) {
  const de = input.locale === "de";
  const greeting = input.name.trim().split(/\s+/)[0] || input.name;
  const changeLines = input.changes.map((change) =>
    de
      ? `- ${change.labelDe}: NEU ${change.current} (vorher: ${change.previous})`
      : `- ${change.labelEn}: NEW ${change.current} (previously: ${change.previous})`,
  );
  const currentLines = de
    ? [
        `Zeitraum: ${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
        `Standort: ${rentalLocationLabels.de[input.location as RentalLocation] ?? input.location}`,
        ...(input.bikes.length ? [`Fahrräder: ${input.bikes.join(", ")}`] : []),
      ]
    : [
        `Rental period: ${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
        `Location: ${rentalLocationLabels.en[input.location as RentalLocation] ?? input.location}`,
        ...(input.bikes.length ? [`Bikes: ${input.bikes.join(", ")}`] : []),
      ];
  const subject = de
    ? `Aktualisierte Buchungsinformationen ${input.orderNumber}`
    : `Updated booking information ${input.orderNumber}`;
  const text = [
    de ? `Hallo ${greeting},` : `Hello ${greeting},`,
    "",
    de
      ? `wir haben die Buchungsinformationen für deine Buchung ${input.orderNumber} geändert.`
      : `We have updated the booking information for your booking ${input.orderNumber}.`,
    "",
    de ? "Geänderte Angaben:" : "Changed details:",
    ...changeLines,
    "",
    de ? "Aktuelle Buchungsinformationen:" : "Current booking information:",
    ...currentLines.map((line) => `- ${line}`),
    "",
    de
      ? "Bitte prüfe die aktualisierten Angaben. Bei Fragen antworte einfach auf diese E-Mail."
      : "Please check the updated details. If you have any questions, simply reply to this email.",
    "",
    de ? "Viele Grüße\nYour Bike Rental" : "Kind regards\nYour Bike Rental",
  ].join("\n");
  const changeRows = input.changes
    .map(
      (change) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#697177;font-size:13px;line-height:1.45">${escapeHtml(de ? change.labelDe : change.labelEn)}</td><td style="padding:8px 0;color:#171a1d;font-size:14px;line-height:1.45"><strong>${escapeHtml(change.current)}</strong><br /><span style="color:#899196;font-size:12px">${escapeHtml(de ? `Vorher: ${change.previous}` : `Previously: ${change.previous}`)}</span></td></tr>`,
    )
    .join("");
  const currentDetails = [
    [
      de ? "Zeitraum" : "Rental period",
      `${input.periodFrom} ${input.pickupTime} – ${input.periodTo} ${input.dropoffTime}`,
    ],
    [
      de ? "Standort" : "Location",
      rentalLocationLabels[input.locale][input.location as RentalLocation] ?? input.location,
    ],
    ...(input.bikes.length ? [[de ? "Fahrräder" : "Bikes", input.bikes.join(", ")]] : []),
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#697177;font-size:13px;line-height:1.45">${escapeHtml(label)}</td><td style="padding:8px 0;color:#171a1d;font-size:14px;line-height:1.45">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = renderEmailLayout({
    locale: input.locale,
    preheader: subject,
    eyebrow: de ? "Buchung geändert" : "Booking changed",
    title: de ? "Buchungsinformationen aktualisiert" : "Booking information updated",
    intro: de
      ? `Wir haben die Buchungsinformationen für deine Buchung ${input.orderNumber} geändert. Die Änderungen sind fett markiert.`
      : `We have updated the booking information for your booking ${input.orderNumber}. The changes are shown in bold.`,
    content: `${emailCard(`${emailLabel(de ? "Geänderte Angaben" : "Changed details")}<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${changeRows}</table>`, "#eef2ff")}${emailCard(`${emailLabel(de ? "Aktuelle Buchungsinformationen" : "Current booking information")}<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${currentDetails}</table>`)}${emailParagraph(de ? "Bitte prüfe die aktualisierten Angaben. Bei Fragen antworte einfach auf diese E-Mail." : "Please check the updated details. If you have any questions, simply reply to this email.")}`,
  });
  return { subject, text, html };
}

export function renderFeedbackRequestMail(input: {
  locale: "de" | "en";
  name: string;
  orderNumber: string;
  token: string;
}) {
  const de = input.locale === "de";
  const greeting = input.name.trim().split(/\s+/)[0] || input.name;
  const subject = de ? `Wie war deine Fahrt? ${input.orderNumber}` : `How was your ride? ${input.orderNumber}`;
  const text = [
    de ? `Hallo ${greeting},` : `Hello ${greeting},`,
    "",
    de
      ? "dein Fahrrad wurde erfolgreich ausgegeben. Wir würden gerne kurz hören, wie alles geklappt hat."
      : "Your bike has been handed over successfully. We would love to hear how everything went.",
    "",
    de
      ? "Bewerte mit wenigen Klicks Fahrrad, Übergabe, Kommunikation, Preis-Leistung und dein Gesamterlebnis. Ein kurzer Kommentar ist optional."
      : "With a few clicks, rate the bike, handover, communication, value for money and your overall experience. A short comment is optional.",
    "",
    feedbackPageUrl(input.token),
    "",
    de
      ? "Vielen Dank für deine Zeit!\nViele Grüße\nYour Bike Rental"
      : "Thank you for your time!\nKind regards\nYour Bike Rental",
  ].join("\n");
  const criteria = feedbackCriteria
    .map(
      (criterion) =>
        `<div style="display:inline-block;margin:0 6px 8px 0;padding:8px 10px;border-radius:999px;background:#f7f8fa;color:#4f5960;font-size:12px">${escapeHtml(de ? criterion.de : criterion.en)}</div>`,
    )
    .join("");
  const html = renderEmailLayout({
    locale: input.locale,
    preheader: de ? "Dein kurzes Feedback ist uns wichtig." : "Your quick feedback matters to us.",
    eyebrow: de ? "Deine Fahrt" : "Your ride",
    title: de ? "Wie war deine Fahrt?" : "How was your ride?",
    intro: de
      ? `Hallo ${greeting}, dein Fahrrad wurde ausgegeben – jetzt zählt dein Eindruck.`
      : `Hello ${greeting}, your bike has been handed over – now we would love to hear your impression.`,
    content: `${emailCard(`${emailParagraph(de ? "Nimm dir bitte eine Minute und bewerte kurz, wie Fahrrad, Übergabe, Kommunikation und Preis-Leistung geklappt haben. Die Sterne sind schnell vergeben, ein Text ist vollkommen optional." : "Please take a minute to rate the bike, handover, communication and value for money. The stars are quick to select, and a comment is completely optional.")}${`<div style="margin-top:16px">${criteria}</div>`}`, "#eef2ff")}${emailCard(`${emailLabel(de ? "Buchung" : "Booking")}<strong style="color:#171a1d;font-size:15px">${escapeHtml(input.orderNumber)}</strong>`)}`,
    cta: { label: de ? "Feedback abgeben" : "Leave feedback", href: feedbackPageUrl(input.token) },
  });
  return { subject, text, html };
}
