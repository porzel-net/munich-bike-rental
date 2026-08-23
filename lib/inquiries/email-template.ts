import { siteConfig } from "../site";

export const EMAIL_LOGO_CID = "your-bike-rental-logo@munich-bike-rental.de";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function htmlText(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

type EmailLayoutInput = {
  locale: "de" | "en";
  preheader: string;
  eyebrow: string;
  title: string;
  intro?: string;
  content: string;
  cta?: { label: string; href: string };
};

const emailColors = {
  accent: "#4169e1",
  accentSoft: "#eef2ff",
  ink: "#171a1d",
  muted: "#697177",
  border: "rgba(23,26,29,.10)",
  page: "#f6f7fb",
};

/**
 * A deliberately table-based, inline-styled email shell. It mirrors the public
 * offer page without depending on external stylesheets or web fonts.
 */
export function renderEmailLayout(input: EmailLayoutInput) {
  const footer =
    input.locale === "de"
      ? "Persönlicher Rennrad- und Gravel-Verleih in München, Regensburg und am Bodensee."
      : "Personal road and gravel bike rental in Munich, Regensburg and around Lake Constance.";
  const footerDetails =
    input.locale === "de"
      ? `Julius Porzel · Your Bike Rental<br />Josephine-Lang-Weg 3 · 81245 München · Deutschland<br /><a href="${escapeHtml(siteConfig.url)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a> · <a href="tel:${escapeHtml(siteConfig.phoneE164)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.phone)}</a> · <a href="mailto:${escapeHtml(siteConfig.email)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.email)}</a>`
      : `Julius Porzel · Your Bike Rental<br />Josephine-Lang-Weg 3 · 81245 Munich · Germany<br /><a href="${escapeHtml(siteConfig.url)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a> · <a href="tel:${escapeHtml(siteConfig.phoneE164)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.phone)}</a> · <a href="mailto:${escapeHtml(siteConfig.email)}" style="color:#697177;text-decoration:underline">${escapeHtml(siteConfig.email)}</a>`;
  const cta = input.cta
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:26px 0 4px"><tr><td align="center" style="border-radius:13px;background:#4169e1"><a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:15px 22px;border-radius:13px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1;text-decoration:none">${escapeHtml(input.cta.label)} &nbsp;→</a></td></tr></table>`
    : "";
  const logoUrl = `cid:${EMAIL_LOGO_CID}`;

  return `<!doctype html>
<html lang="${input.locale}">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-wrap { width: 100% !important; }
        .email-pad { padding: 24px 18px !important; }
        .email-title { font-size: 31px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${emailColors.page};background-image:radial-gradient(circle at 14% 16%,rgba(65,105,225,.14) 0,rgba(65,105,225,.14) 18%,transparent 42%),radial-gradient(circle at 84% 18%,rgba(45,212,191,.12) 0,rgba(45,212,191,.12) 16%,transparent 38%),radial-gradient(circle at 58% 88%,rgba(255,159,115,.14) 0,rgba(255,159,115,.14) 18%,transparent 44%),linear-gradient(180deg,#f9f7f1 0%,#f6f7fb 100%);color:${emailColors.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${emailColors.page};background-image:radial-gradient(circle at 14% 16%,rgba(65,105,225,.14) 0,rgba(65,105,225,.14) 18%,transparent 42%),radial-gradient(circle at 84% 18%,rgba(45,212,191,.12) 0,rgba(45,212,191,.12) 16%,transparent 38%),linear-gradient(180deg,#f9f7f1 0%,#f6f7fb 100%)">
      <tr><td align="center" style="padding:28px 12px 40px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" class="email-wrap" style="width:100%;max-width:640px">
          <tr><td style="padding:0 4px 18px">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.02em;color:${emailColors.ink}">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                    <tr>
                      <td valign="middle" style="width:38px;height:30px;line-height:30px">
                        <img src="${escapeHtml(logoUrl)}" alt="Your Bike Rental" width="30" height="30" style="display:block;width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:50% 34%" />
                      </td>
                      <td valign="middle" style="height:30px;color:${emailColors.ink};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:30px;white-space:nowrap">Your Bike Rental</td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="color:#71777c;font-size:11px;letter-spacing:.04em">${escapeHtml(input.eyebrow)}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="email-pad" style="padding:38px 40px 34px;border:1px solid ${emailColors.border};border-radius:25px;background:rgba(255,255,255,.94);box-shadow:0 20px 50px rgba(23,26,29,.055)">
            <h1 class="email-title" style="margin:0 0 14px;color:${emailColors.ink};font-family:Poppins,Arial,Helvetica,sans-serif;font-size:40px;font-weight:900;letter-spacing:-.055em;line-height:.98">${escapeHtml(input.title)}</h1>
            ${input.intro ? `<p style="margin:0 0 25px;color:#697177;font-size:16px;line-height:1.65">${htmlText(input.intro)}</p>` : ""}
            ${input.content}
            ${cta}
          </td></tr>
          <tr><td style="padding:18px 8px 0;color:#899196;font-size:11px;line-height:1.55;text-align:center">${escapeHtml(footer)}<br />${footerDetails}<br />${escapeHtml(input.locale === "de" ? "Viele Grüße" : "Kind regards")}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function emailCard(content: string, background = "#f7f8fa") {
  return `<div style="margin:0 0 16px;padding:18px 20px;border:1px solid #e5e8eb;border-radius:16px;background:${background}">${content}</div>`;
}

export function emailLabel(label: string) {
  return `<span style="display:block;margin-bottom:5px;color:#7a8288;font-size:10px;font-weight:700;letter-spacing:.04em;line-height:1.3">${escapeHtml(label)}</span>`;
}

export function emailParagraph(text: string, color = "#4f5960") {
  return `<p style="margin:0;color:${color};font-size:14px;line-height:1.65">${htmlText(text)}</p>`;
}
