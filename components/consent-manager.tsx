"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { buildConsentCookieValue, type ConsentPreferences, type ConsentState } from "../lib/consent";
import { consentCopy } from "../lib/consent-copy";

type ConsentContextValue = {
  locale: "de" | "en";
  analyticsAllowed: boolean;
  openSettings: () => void;
  saveNecessaryOnly: () => void;
  saveAll: () => void;
  saveSelection: (preferences: ConsentPreferences) => void;
  trackLead: (payload: {
    bikeTitle?: string;
    language: "de" | "en";
    contactMethod?: "email" | "phone" | "whatsapp" | "other";
  }) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function writeConsentCookie(preferences: ConsentPreferences) {
  const cookieValue = buildConsentCookieValue(preferences);
  const maxAge = 60 * 60 * 24 * 365;
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${encodeURIComponent("munich_rental_consent")}=${cookieValue}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;
}

function getGtag() {
  const win = window as Window & {
    gtag?: (...args: Array<string | number | boolean | Record<string, string | number | boolean | undefined>>) => void;
  };

  return win.gtag;
}

function normalizeSearchLocale(searchParams: ReturnType<typeof useSearchParams>, fallback: "de" | "en") {
  return searchParams.get("lang") === "en" ? "en" : fallback;
}

export function useConsent() {
  const value = useContext(ConsentContext);

  if (!value) {
    return {
      locale: "de" as const,
      analyticsAllowed: false,
      openSettings: () => {},
      saveNecessaryOnly: () => {},
      saveAll: () => {},
      saveSelection: () => {},
      trackLead: () => {},
    };
  }

  return value;
}

export function ConsentProvider({
  children,
  initialConsent,
  initialLocale,
  nonce,
  googleAnalyticsId,
  googleAdsConversionId,
  googleAdsConversionLabel,
}: {
  children: ReactNode;
  initialConsent: ConsentState | null;
  initialLocale: "de" | "en";
  nonce?: string;
  googleAnalyticsId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = normalizeSearchLocale(searchParams, initialLocale);
  const copy = consentCopy[locale];
  const [consent, setConsent] = useState<ConsentState | null>(initialConsent);
  const [panelOpen, setPanelOpen] = useState(!initialConsent);
  const [draft, setDraft] = useState<ConsentPreferences>(initialConsent ? { analytics: initialConsent.analytics } : { analytics: false });

  useEffect(() => {
    if (!consent) {
      return;
    }

    writeConsentCookie({ analytics: consent.analytics });
  }, [consent]);

  useEffect(() => {
    if (!consent?.analytics || !googleAnalyticsId) {
      return;
    }

    const gtag = getGtag();
    if (!gtag) {
      return;
    }

    const searchString = searchParams.toString();
    const pagePath = searchString ? `${pathname}?${searchString}` : pathname;

    gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title,
    });
  }, [consent?.analytics, googleAnalyticsId, pathname, searchParams]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      locale,
      analyticsAllowed: Boolean(consent?.analytics && googleAnalyticsId),
      openSettings: () => {
        setDraft(consent ? { analytics: consent.analytics } : { analytics: false });
        setPanelOpen(true);
      },
      saveNecessaryOnly: () => {
        const next = { analytics: false };
        setConsent({ ...next, updatedAt: new Date().toISOString() });
        setDraft(next);
        setPanelOpen(false);
      },
      saveAll: () => {
        const next = { analytics: true };
        setConsent({ ...next, updatedAt: new Date().toISOString() });
        setDraft(next);
        setPanelOpen(false);
      },
      saveSelection: (preferences: ConsentPreferences) => {
        setConsent({ ...preferences, updatedAt: new Date().toISOString() });
        setDraft(preferences);
        setPanelOpen(false);
      },
      trackLead: ({ bikeTitle, language, contactMethod }) => {
        if (!consent?.analytics || !googleAnalyticsId) {
          return;
        }

        const gtag = getGtag();
        if (!gtag) {
          return;
        }

        gtag("event", "generate_lead", {
          event_category: "contact",
          event_label: bikeTitle || "contact_form",
          language,
          contact_method: contactMethod,
          page_location: window.location.href,
        });

        if (googleAdsConversionId && googleAdsConversionLabel) {
          gtag("event", "conversion", {
            send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}`,
            value: 1,
            currency: "EUR",
            event_label: bikeTitle || "contact_form",
          });
        }
      },
    }),
    [consent, googleAnalyticsId, googleAdsConversionId, googleAdsConversionLabel, locale],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}

      {consent?.analytics && googleAnalyticsId ? (
        <>
          <Script
            id="google-analytics-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="google-analytics-init" strategy="afterInteractive" nonce={nonce}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsId}', {
                send_page_view: false,
                anonymize_ip: true,
                allow_google_signals: false
              });
            `}
          </Script>
        </>
      ) : null}

      {panelOpen || !consent ? (
        <div className="cookie-banner" role="dialog" aria-modal="true" aria-label={copy.bannerTitle}>
          <div className="cookie-banner__panel">
            <div className="cookie-banner__header">
              <div>
                <span className="cookie-banner__eyebrow">{copy.bannerTitle}</span>
                <h2 className="cookie-banner__title">{copy.bannerTitle}</h2>
              </div>
              <p className="cookie-banner__intro">{copy.bannerIntro}</p>
            </div>

            <div className="cookie-banner__choices">
              <label className="cookie-banner__choice">
                <span className="cookie-banner__choice-copy">
                  <strong>{copy.necessaryTitle}</strong>
                  <span>{copy.necessaryText}</span>
                </span>
                <input type="checkbox" checked disabled aria-label={copy.necessaryTitle} />
              </label>

              <label className="cookie-banner__choice">
                <span className="cookie-banner__choice-copy">
                  <strong>{copy.analyticsTitle}</strong>
                  <span>{copy.analyticsText}</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))}
                  aria-label={copy.analyticsTitle}
                />
              </label>
            </div>

            <div className="cookie-banner__actions">
              <button
                type="button"
                className="cookie-banner__button cookie-banner__button--ghost"
                onClick={value.saveNecessaryOnly}
              >
                {copy.acceptNecessary}
              </button>
              <button
                type="button"
                className="cookie-banner__button cookie-banner__button--ghost"
                onClick={() => value.saveSelection(draft)}
              >
                {copy.saveSelection}
              </button>
              <button type="button" className="cookie-banner__button cookie-banner__button--primary" onClick={value.saveAll}>
                {copy.acceptAll}
              </button>
            </div>

            <div className="cookie-banner__footer">
              <button type="button" className="cookie-banner__link" onClick={value.openSettings}>
                {copy.settingsButton}
              </button>
              <Link href="/datenschutzerklaerung" className="cookie-banner__link">
                {copy.privacyLink}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!panelOpen && consent ? (
        <button type="button" className="cookie-settings-trigger" onClick={value.openSettings}>
          {copy.settingsButton}
        </button>
      ) : null}
    </ConsentContext.Provider>
  );
}
