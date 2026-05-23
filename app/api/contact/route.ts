import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ContactPayload = {
  name?: string;
  contact?: string;
  message?: string;
  bikeTitle?: string;
  locale?: "de" | "en";
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeLine(value: string, maxLength = 200) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string) {
  return /^[+\d][\d\s()./-]{5,}$/.test(value);
}

function createMailBody(
  payload: Required<Pick<ContactPayload, "name" | "contact" | "message" | "bikeTitle" | "locale">>,
) {
  if (payload.locale === "de") {
    return [
      "Neue Bike-Anfrage",
      "",
      `Name: ${payload.name}`,
      `Kontakt: ${payload.contact}`,
      payload.bikeTitle ? `Bike: ${payload.bikeTitle}` : "Bike: -",
      "",
      "Nachricht:",
      payload.message,
    ].join("\n");
  }

  return [
    "New bike inquiry",
    "",
    `Name: ${payload.name}`,
    `Contact: ${payload.contact}`,
    payload.bikeTitle ? `Bike: ${payload.bikeTitle}` : "Bike: -",
    "",
    "Message:",
    payload.message,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;
    const name = sanitizeLine(asText(body?.name), 120);
    const contact = sanitizeLine(asText(body?.contact), 254);
    const message = asText(body?.message).slice(0, 4000);
    const bikeTitle = sanitizeLine(asText(body?.bikeTitle), 120);
    const locale = body?.locale === "en" ? "en" : "de";

    const contactIsEmail = isEmail(contact);
    const contactIsPhone = isPhoneNumber(contact);

    if (!contact || (!contactIsEmail && !contactIsPhone) || !message) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const fromAddress = process.env.MAIL_FROM_ADDRESS ?? "anfrage@munich-bike-rental.de";
    const toAddress = process.env.MAIL_TO_ADDRESS ?? "hallo@munich-bike-rental.de";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return NextResponse.json({ ok: false, error: "Mail configuration is incomplete" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `Munich Rental <${fromAddress}>`,
      to: toAddress,
      replyTo: contactIsEmail ? contact : undefined,
      subject: bikeTitle ? `Bike inquiry - ${bikeTitle}` : "Bike inquiry",
      text: createMailBody({
        name,
        contact,
        message,
        bikeTitle,
        locale,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to send message" }, { status: 500 });
  }
}
