import { BUSINESS_TIME_ZONE, formatDateTime } from "../datetime";

const ORDER_NUMBER_PATTERN = /^#?(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

/** Reads the local Europe/Berlin timestamp encoded in #YYYYMMDDHHMMSS. */
export function receivedAtFromOrderNumber(orderNumber: string) {
  const match = orderNumber.trim().match(ORDER_NUMBER_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const requestedLocalUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const berlinParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(requestedLocalUtc))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const displayedAsUtc = Date.UTC(
    Number(berlinParts.year),
    Number(berlinParts.month) - 1,
    Number(berlinParts.day),
    Number(berlinParts.hour) % 24,
    Number(berlinParts.minute),
    Number(berlinParts.second),
  );
  const date = new Date(requestedLocalUtc - (displayedAsUtc - requestedLocalUtc));
  return Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
    ? null
    : date;
}

export function formatReceivedAt(orderNumber: string) {
  const receivedAt = receivedAtFromOrderNumber(orderNumber);
  return receivedAt ? formatDateTime(receivedAt) : null;
}
