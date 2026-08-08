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

/**
 * A deliberately table-based, inline-styled email shell. It mirrors the public
 * offer page without depending on external stylesheets or web fonts.
 */
export function renderEmailLayout(input: EmailLayoutInput) {
  const footer =
    input.locale === "de"
      ? "Persönlicher Rennrad- und Gravel-Verleih in München, Regensburg und am Bodensee."
      : "Personal road and gravel bike rental in Munich, Regensburg and around Lake Constance.";
  const cta = input.cta
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:26px 0 4px"><tr><td align="center" style="border-radius:13px;background:#4169e1"><a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:15px 22px;border-radius:13px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1;text-decoration:none">${escapeHtml(input.cta.label)} &nbsp;→</a></td></tr></table>`
    : "";

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
  <body style="margin:0;padding:0;background:#f5f6f8;color:#171a1d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f6f8">
      <tr><td align="center" style="padding:28px 12px 40px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" class="email-wrap" style="width:100%;max-width:640px">
          <tr><td style="padding:0 4px 18px">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.02em;color:#171a1d">
                  <span style="display:inline-block;width:30px;height:30px;margin-right:8px;border-radius:50%;background:#171a1d;color:#ffffff;font-size:14px;line-height:30px;text-align:center;vertical-align:middle">M</span>
                  <span style="vertical-align:middle">Munich Bike Rental</span>
                </td>
                <td align="right" style="color:#71777c;font-size:11px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(input.eyebrow)}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="email-pad" style="padding:38px 40px 34px;border:1px solid #e1e4e8;border-radius:24px;background:#ffffff;box-shadow:0 18px 50px rgba(23,26,29,.07)">
            <h1 class="email-title" style="margin:0 0 14px;color:#171a1d;font-family:Arial,Helvetica,sans-serif;font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1.05">${escapeHtml(input.title)}</h1>
            ${input.intro ? `<p style="margin:0 0 25px;color:#697177;font-size:16px;line-height:1.65">${htmlText(input.intro)}</p>` : ""}
            ${input.content}
            ${cta}
          </td></tr>
          <tr><td style="padding:18px 8px 0;color:#899196;font-size:11px;line-height:1.55;text-align:center">${escapeHtml(footer)}<br />Munich Bike Rental · ${escapeHtml(input.locale === "de" ? "Viele Grüße" : "Kind regards")}</td></tr>
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
  return `<span style="display:block;margin-bottom:5px;color:#7a8288;font-size:10px;font-weight:700;letter-spacing:.08em;line-height:1.3;text-transform:uppercase">${escapeHtml(label)}</span>`;
}

export function emailParagraph(text: string, color = "#4f5960") {
  return `<p style="margin:0;color:${color};font-size:14px;line-height:1.65">${htmlText(text)}</p>`;
}
