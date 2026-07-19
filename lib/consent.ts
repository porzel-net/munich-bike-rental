export type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentState = ConsentPreferences & {
  updatedAt: string;
};

export const CONSENT_COOKIE_NAME = "munich_rental_consent";

function isConsentPreferences(value: unknown): value is ConsentPreferences {
  return (
    Boolean(value) && typeof value === "object" && typeof (value as { analytics?: unknown }).analytics === "boolean"
  );
}

function extractCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}

export function parseConsentCookie(cookieHeader: string | null | undefined): ConsentState | null {
  const rawValue = extractCookieValue(cookieHeader, CONSENT_COOKIE_NAME);

  if (!rawValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded) as unknown;

    if (
      Boolean(parsed) &&
      typeof parsed === "object" &&
      isConsentPreferences(parsed) &&
      typeof (parsed as { updatedAt?: unknown }).updatedAt === "string"
    ) {
      const parsedState = parsed as ConsentState;

      // Consent cookies written before the marketing purpose was introduced remain valid,
      // but must never implicitly grant marketing consent.
      return {
        necessary: true,
        analytics: parsedState.analytics,
        marketing: typeof (parsed as { marketing?: unknown }).marketing === "boolean" ? parsed.marketing : false,
        updatedAt: parsedState.updatedAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function buildConsentCookieValue(preferences: ConsentPreferences) {
  return encodeURIComponent(
    JSON.stringify({
      necessary: true,
      analytics: preferences.analytics,
      marketing: preferences.marketing,
      updatedAt: new Date().toISOString(),
    }),
  );
}
