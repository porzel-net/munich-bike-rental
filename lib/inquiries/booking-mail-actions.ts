import { findLatestBookingThreadMessage, moveMailToRejectedMailbox, type MailboxOperationResult } from "./mailbox";
import { sendConfiguredMail } from "./server";
import { emailCard, emailLabel, emailParagraph, escapeHtml, renderEmailLayout } from "./email-template";
import { parseMailMessageIds } from "./mail-thread";

export type BookingMailAction = "confirmation" | "rejection";

export type BookingMailActionInput = {
  locale: "de" | "en";
  orderNumber: string;
  name: string;
  email: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  rentalDays: number;
  totalPriceCents: number;
  bikes: string[];
  locationAddress: string;
  senderFirstName: string;
  personalMessage?: string;
  source: "automatic" | "manual";
  threadMessageId: string | null;
  confirmationLink?: string;
};

export type BookingMailActionResult =
  | { ok: false; reason: "thread_missing"; threadRequired: true }
  | { ok: false; reason: "mail_config" }
  | {
      ok: true;
      messageId: string | null;
      threadMessageId: string | null;
      mailbox: MailboxOperationResult | null;
    };

function formatPrice(cents: number, locale: "de" | "en") {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function getSubject(action: BookingMailAction, orderNumber: string, locale: "de" | "en") {
  return locale === "de"
    ? action === "confirmation"
      ? `Buchungsbestätigung ${orderNumber}`
      : `Buchung abgelehnt ${orderNumber}`
    : action === "confirmation"
      ? `Booking confirmation ${orderNumber}`
      : `Booking declined ${orderNumber}`;
}

function getRecipientFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name.trim();
}

function getText(action: BookingMailAction, booking: BookingMailActionInput) {
  const de = booking.locale === "de";
  const firstName = getRecipientFirstName(booking.name);
  if (!de && action === "confirmation") {
    const depositTotalEuro = booking.bikes.length * 100;
    return [
      `Hello ${firstName},`,
      "",
      "Thank you for your inquiry! Good news: the bike you requested is available.",
      "",
      "Here are the most important details:",
      "",
      `Bike: ${booking.bikes.join(" / ")}`,
      "",
      `Rental period: ${booking.rentalDays} ${booking.rentalDays === 1 ? "day" : "days"}`,
      "",
      `Total price: ${formatPrice(booking.totalPriceCents, booking.locale)}`,
      "",
      `Pickup: ${booking.periodFrom} at ${booking.pickupTime}`,
      "",
      `Return: ${booking.periodTo} at ${booking.dropoffTime}`,
      "",
      `Location: ${booking.locationAddress}`,
      "",
      "When you arrive, please call +49 89 54193577 if nobody is downstairs.",
      "",
      "If you would like to accept the offer, confirm your booking using this link:",
      booking.confirmationLink ?? "",
      "",
      "Please then transfer 50% of the total price. The remaining 50% is due no later than when the bike is returned:",
      "",
      "Account holder: Julius Porzel",
      "IBAN: DE50100123450750947701",
      `Reference: ${booking.orderNumber}`,
      "",
      "The offer remains reserved for you for 24 hours. Please email us the transfer confirmation afterwards.",
      "",
      `Please also bring a €100 cash deposit per bike for pickup (€${depositTotalEuro} in total).`,
      "",
      "We look forward to seeing you on the bike soon!",
      "",
      "Kind regards,",
      booking.senderFirstName,
    ].join("\n");
  }
  if (!de) {
    return [
      `Hello ${firstName},`,
      "",
      "Thank you for your inquiry.",
      "",
      "Unfortunately, I cannot offer you a suitable bike for this period. Please feel free to ask again for another date. :)",
      "",
      "We hope you find what you are looking for and wish you a good ride.",
      "",
      "Kind regards",
      booking.senderFirstName,
    ].join("\n");
  }
  if (action === "confirmation") {
    const depositTotalEuro = booking.bikes.length * 100;
    return [
      `Hallo ${getRecipientFirstName(booking.name)},`,
      "",
      "vielen Dank für deine Anfrage! Gute Nachrichten: Das gewünschte Fahrrad ist für dich verfügbar.",
      "",
      "Hier sind nochmal die wichtigsten Infos:",
      "",
      `Fahrrad: ${booking.bikes.join(" / ")}`,
      "",
      `Mietdauer: ${booking.rentalDays} ${booking.rentalDays === 1 ? "Tag" : "Tage"}`,
      "",
      `Gesamtpreis: ${formatPrice(booking.totalPriceCents, booking.locale)}`,
      "",
      `Abholung: ${booking.periodFrom} um ${booking.pickupTime} Uhr`,
      "",
      `Rückgabe: ${booking.periodTo} um ${booking.dropoffTime} Uhr`,
      "",
      `Ort: ${booking.locationAddress}`,
      "",
      "Wenn du da bist und noch keiner unten steht, bitte bei +49 89 54193577 anrufen!",
      "",
      "Wenn du das Angebot annehmen möchtest, bestätige deine Buchung über diesen Link:",
      booking.confirmationLink ?? "",
      "",
      "Bitte überweise anschließend 50 % des Gesamtpreises. Die restlichen 50 % sind spätestens bei der Rückgabe fällig:",
      "",
      "Kontoinhaber: Julius Porzel",
      "IBAN: DE50100123450750947701",
      `Verwendungszweck: ${booking.orderNumber}`,
      "",
      "Das Angebot bleibt 24 Stunden für dich reserviert. Schick uns danach bitte die Überweisungsbestätigung per Mail.",
      "",
      `Bitte bringe zur Abholung außerdem 100 € Kaution pro Bike in bar mit (also insgesamt ${depositTotalEuro} €).`,
      "",
      "Wir freuen uns, dich bald auf dem Rad zu sehen!",
      "",
      "Liebe Grüße,",
      booking.senderFirstName,
    ].join("\n");
  }

  return [
    `Hallo ${getRecipientFirstName(booking.name)},`,
    "",
    "vielen Dank für deine Anfrage.",
    "",
    "Leider kann ich dir für den Zeitraum kein passendes Fahrrad anbieten. Gerne frag nochmal für wann anders an. :)",
    "",
    "Wir hoffen, dass du noch fündig wirst und wünschen dir eine gute Fahrt.",
    "",
    "Liebe Grüße",
    booking.senderFirstName,
  ].join("\n");
}

function getHtml(action: BookingMailAction, booking: BookingMailActionInput) {
  if (booking.locale === "en") {
    const confirmation = action === "confirmation";
    const firstName = getRecipientFirstName(booking.name);
    const depositTotalEuro = booking.bikes.length * 100;
    const details = confirmation
      ? emailCard(
          `${emailLabel("Booking details")}<strong style="display:block;color:#171a1d;font-size:15px">${escapeHtml(booking.bikes.join(" / "))}</strong><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px"><tr><td style="padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Rental period")}${escapeHtml(`${booking.rentalDays} ${booking.rentalDays === 1 ? "day" : "days"}`)}</td><td style="color:#697177;font-size:13px;line-height:1.5">${emailLabel("Total price")}${escapeHtml(formatPrice(booking.totalPriceCents, booking.locale))}</td></tr><tr><td style="padding-top:10px;padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Pickup")}${escapeHtml(`${booking.periodFrom} at ${booking.pickupTime}`)}</td><td style="padding-top:10px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Return")}${escapeHtml(`${booking.periodTo} at ${booking.dropoffTime}`)}</td></tr></table>`,
        )
      : emailCard(
          emailParagraph(
            "Unfortunately, I cannot offer you a suitable bike for this period. Please feel free to ask again for another date. :)",
          ),
        );
    const intro = confirmation
      ? "Thank you for your inquiry! Good news: the bike you requested is available."
      : "Thank you for your inquiry.";
    const content = `${booking.personalMessage?.trim() ? emailCard(emailParagraph(booking.personalMessage), "#eef2ff") : ""}${details}${confirmation ? emailCard(`${emailLabel("Next step")}${emailParagraph(`Confirm your booking using the link and then transfer 50% of the total price. The remaining 50% is due when the bike is returned; the offer remains reserved for 24 hours. Please also bring a €100 cash deposit per bike for pickup (€${depositTotalEuro} in total).`)}`, "#eef2ff") : emailParagraph("We hope you find what you are looking for and wish you a good ride.")}`;
    return renderEmailLayout({
      locale: "en",
      preheader: getSubject(action, booking.orderNumber, booking.locale),
      eyebrow: confirmation ? "Booking confirmation" : "Inquiry",
      title: confirmation ? `Good news, ${firstName}` : `Thank you, ${firstName}`,
      intro,
      content,
      cta:
        confirmation && booking.confirmationLink
          ? { label: "Confirm booking", href: booking.confirmationLink }
          : undefined,
    });
  }
  const confirmation = action === "confirmation";
  const firstName = getRecipientFirstName(booking.name);
  const depositTotalEuro = booking.bikes.length * 100;
  const details = confirmation
    ? emailCard(
        `${emailLabel("Buchungsdetails")}<strong style="display:block;color:#171a1d;font-size:15px">${escapeHtml(booking.bikes.join(" / "))}</strong><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px"><tr><td style="padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Mietdauer")}${escapeHtml(`${booking.rentalDays} ${booking.rentalDays === 1 ? "Tag" : "Tage"}`)}</td><td style="color:#697177;font-size:13px;line-height:1.5">${emailLabel("Gesamtpreis")}${escapeHtml(formatPrice(booking.totalPriceCents, booking.locale))}</td></tr><tr><td style="padding-top:10px;padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Abholung")}${escapeHtml(`${booking.periodFrom} um ${booking.pickupTime} Uhr`)}</td><td style="padding-top:10px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Rückgabe")}${escapeHtml(`${booking.periodTo} um ${booking.dropoffTime} Uhr`)}</td></tr></table>`,
      )
    : emailCard(
        emailParagraph(
          "Leider kann ich dir für den Zeitraum kein passendes Fahrrad anbieten. Gerne frag nochmal für wann anders. :)",
        ),
      );
  const intro = confirmation
    ? "vielen Dank für deine Anfrage! Gute Nachrichten: Das gewünschte Fahrrad ist für dich verfügbar."
    : "vielen Dank für deine Anfrage.";
  const content = `${booking.personalMessage?.trim() ? emailCard(emailParagraph(booking.personalMessage), "#eef2ff") : ""}${details}${confirmation ? emailCard(`${emailLabel("Nächster Schritt")}${emailParagraph(`Bestätige deine Buchung über den Link und überweise anschließend 50 % des Gesamtpreises. Die restlichen 50 % sind bei der Rückgabe fällig; das Angebot bleibt 24 Stunden reserviert. Bitte bringe zur Abholung außerdem 100 € Kaution pro Bike in bar mit (also insgesamt ${depositTotalEuro} €).`)}`, "#eef2ff") : emailParagraph("Wir hoffen, dass du noch fündig wirst und wünschen dir eine gute Fahrt.")}`;
  return renderEmailLayout({
    locale: "de",
    preheader: getSubject(action, booking.orderNumber, booking.locale),
    eyebrow: confirmation ? "Buchungsbestätigung" : "Anfrage",
    title: confirmation ? `Gute Nachrichten, ${firstName}` : `Danke, ${firstName}`,
    intro,
    content,
    cta:
      confirmation && booking.confirmationLink
        ? { label: "Buchung bestätigen", href: booking.confirmationLink }
        : undefined,
  });
}

export async function sendBookingMailAction(
  action: BookingMailAction,
  booking: BookingMailActionInput,
  forceWithoutThread = false,
): Promise<BookingMailActionResult> {
  let threadMessageId = booking.threadMessageId;
  let referencesHeader: string | null = null;
  if (booking.source === "automatic" && !threadMessageId) {
    const latest = await findLatestBookingThreadMessage(booking.orderNumber);
    threadMessageId = latest?.messageId ?? null;
    referencesHeader = latest?.referencesHeader ?? null;
    if (!threadMessageId && !forceWithoutThread) {
      return { ok: false, reason: "thread_missing", threadRequired: true };
    }
  } else if (booking.source === "automatic") {
    const latest = await findLatestBookingThreadMessage(booking.orderNumber);
    if (latest) {
      threadMessageId = latest.messageId;
      referencesHeader = latest.referencesHeader;
    }
  }

  const references = parseMailMessageIds(referencesHeader);
  if (threadMessageId) references.push(threadMessageId);

  const sent = await sendConfiguredMail({
    account: "main",
    subject: getSubject(action, booking.orderNumber, booking.locale),
    text: getText(action, booking),
    html: getHtml(action, booking),
    to: booking.email,
    inReplyTo: threadMessageId ?? undefined,
    references: [...new Set(references)].join(" ") || undefined,
  });
  if (!sent) return { ok: false, reason: "mail_config" };

  let mailbox = action === "rejection" ? await moveMailToRejectedMailbox(sent.messageId) : null;
  if (action === "rejection" && threadMessageId && threadMessageId !== sent.messageId) {
    const threadMailbox = await moveMailToRejectedMailbox(threadMessageId);
    if (threadMailbox.moved) {
      mailbox = { configured: true, moved: true };
    } else if (!mailbox?.moved && (mailbox?.configured || threadMailbox.configured)) {
      mailbox = {
        configured: true,
        moved: false,
        reason:
          threadMailbox.configured && threadMailbox.reason
            ? threadMailbox.reason
            : mailbox?.configured && mailbox.reason
              ? mailbox.reason
              : "move_failed",
      };
    }
  }
  return { ok: true, messageId: sent.messageId, threadMessageId, mailbox };
}
