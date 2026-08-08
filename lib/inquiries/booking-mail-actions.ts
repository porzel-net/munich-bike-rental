import { findBookingThreadMessageId, moveMailToRejectedMailbox, type MailboxOperationResult } from "./mailbox";
import { sendConfiguredMail } from "./server";
import { emailCard, emailLabel, emailParagraph, escapeHtml, renderEmailLayout } from "./email-template";

export type BookingMailAction = "confirmation" | "rejection";

export type BookingMailActionInput = {
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

function formatPrice(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function getSubject(action: BookingMailAction, orderNumber: string) {
  return action === "confirmation" ? `Buchungsbestätigung ${orderNumber}` : `Buchung abgelehnt ${orderNumber}`;
}

function getRecipientFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name.trim();
}

function getText(action: BookingMailAction, booking: BookingMailActionInput) {
  if (action === "confirmation") {
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
      `Gesamtpreis: ${formatPrice(booking.totalPriceCents)}`,
      "",
      `Abholung: ${booking.periodFrom} um ${booking.pickupTime} Uhr`,
      "",
      `Rückgabe: ${booking.periodTo} um ${booking.dropoffTime} Uhr`,
      "",
      `Ort: ${booking.locationAddress}`,
      "",
      "Wenn du da bist und noch keiner unten steht, bitte bei +49 89 54193577 anrufen!",
      "",
      "Bitte bestätige nochmal deine Buchung mit folgendem Link:",
      booking.confirmationLink ?? "",
      "",
      "Damit wir das Fahrrad verbindlich für dich reservieren können, überweise bitte 50 % des Gesamtpreises auf folgendes Konto:",
      "",
      "Kontoinhaber: Julius Porzel",
      "IBAN: DE50100123450750947701",
      `Verwendungszweck: ${booking.orderNumber}`,
      "",
      "Schick uns danach einfach kurz die Überweisungsbestätigung per Mail. Dafür hast du 24 Stunden Zeit, in denen niemand anderes das Rad reservieren kann. Sobald wir die Überweisungsbestätigung (Bild per Mail) von dir erhalten haben, ist das Fahrrad fest für dich reserviert.",
      "",
      "Der restliche Betrag muss spätestens bis zur Rückgabe des Fahrrads überwiesen werden.",
      "",
      "Bitte bringe noch zur Abholung 100€ Kaution in Bar mit!",
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
  const confirmation = action === "confirmation";
  const firstName = getRecipientFirstName(booking.name);
  const details = confirmation
    ? emailCard(
        `${emailLabel("Buchungsdetails")}<strong style="display:block;color:#171a1d;font-size:15px">${escapeHtml(booking.bikes.join(" / "))}</strong><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px"><tr><td style="padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Mietdauer")}${escapeHtml(`${booking.rentalDays} ${booking.rentalDays === 1 ? "Tag" : "Tage"}`)}</td><td style="color:#697177;font-size:13px;line-height:1.5">${emailLabel("Gesamtpreis")}${escapeHtml(formatPrice(booking.totalPriceCents))}</td></tr><tr><td style="padding-top:10px;padding-right:12px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Abholung")}${escapeHtml(`${booking.periodFrom} um ${booking.pickupTime} Uhr`)}</td><td style="padding-top:10px;color:#697177;font-size:13px;line-height:1.5">${emailLabel("Rückgabe")}${escapeHtml(`${booking.periodTo} um ${booking.dropoffTime} Uhr`)}</td></tr></table>`,
      )
    : emailCard(
        emailParagraph(
          "Leider kann ich dir für den Zeitraum kein passendes Fahrrad anbieten. Gerne frag nochmal für wann anders. :)",
        ),
      );
  const intro = confirmation
    ? "vielen Dank für deine Anfrage! Gute Nachrichten: Das gewünschte Fahrrad ist für dich verfügbar."
    : "vielen Dank für deine Anfrage.";
  const content = `${booking.personalMessage?.trim() ? emailCard(emailParagraph(booking.personalMessage), "#eef2ff") : ""}${details}${confirmation ? emailCard(`${emailLabel("Nächster Schritt")}${emailParagraph("Bitte bestätige deine Buchung über den Link. Anschließend überweise 50 % des Gesamtpreises und sende uns die Bestätigung per Mail.")}`, "#eef2ff") : emailParagraph("Wir hoffen, dass du noch fündig wirst und wünschen dir eine gute Fahrt.")}`;
  return renderEmailLayout({
    locale: "de",
    preheader: getSubject(action, booking.orderNumber),
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
  if (booking.source === "automatic" && !threadMessageId) {
    threadMessageId = await findBookingThreadMessageId(booking.orderNumber);
    if (!threadMessageId && !forceWithoutThread) {
      return { ok: false, reason: "thread_missing", threadRequired: true };
    }
  }

  const sent = await sendConfiguredMail({
    account: "main",
    subject: getSubject(action, booking.orderNumber),
    text: getText(action, booking),
    html: getHtml(action, booking),
    to: booking.email,
    inReplyTo: threadMessageId ?? undefined,
    references: threadMessageId ?? undefined,
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
