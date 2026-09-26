import { randomInt } from "node:crypto";

export const AUTOMATIC_LOCATION_REJECTION_KIND = "automatic_location_rejection";
export const AUTOMATIC_LOCATION_REJECTION_MIN_DELAY_MS = 60 * 60 * 1_000;
export const AUTOMATIC_LOCATION_REJECTION_MAX_DELAY_MS = 2 * 60 * 60 * 1_000;

export const automaticLocationRejectionReason = {
  de: "Fahrräder wurden wegen Off-Season bereits eingewintert.",
  en: "The bikes were already winterized for the off-season.",
} as const;

/** Only public inquiries are auto-rejected; staff-created and imported records are not. */
export function shouldAutomaticallyRejectLocation(source: string, location: string) {
  return source === "web" && location !== "munich";
}

/** Creates the delay once, at inquiry intake, so retries keep the original due time. */
export function getAutomaticLocationRejectionDelayMs() {
  return randomInt(AUTOMATIC_LOCATION_REJECTION_MIN_DELAY_MS, AUTOMATIC_LOCATION_REJECTION_MAX_DELAY_MS);
}
