export function formatEuro(cents: number, locale: "de" | "en" = "de") {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Converts a human-entered Euro value without accepting floating point cents. */
export function euroToCents(value: string | number) {
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** The complete rental amount becomes due when a booking is confirmed. */
export function confirmedBookingChargeCents(totalCents: number) {
  return totalCents;
}
