export const BUSINESS_TIME_ZONE = "Europe/Berlin";

export function berlinDateKey(value: Date | number = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(typeof value === "number" ? new Date(value) : value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function berlinYear(value: Date | number = new Date()) {
  return Number(berlinDateKey(value).slice(0, 4));
}

/** Date-only values are calendar dates, never local browser dates. */
export function parseDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function addDateOnlyDays(value: string, days: number) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addDateOnlyMonths(value: string, months: number) {
  const date = parseDateOnly(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return date.toISOString().slice(0, 10);
}

/** Converts a business date into a stable local-noon value for date pickers. */
export function dateOnlyToLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDateOnly(value: string, locale: "de" | "en" = "de", options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    ...options,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(parseDateOnly(value));
}

export function formatDateTime(value: Date | string, locale: "de" | "en" = "de") {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(typeof value === "string" ? (value.length === 10 ? parseDateOnly(value) : new Date(value)) : value);
}
