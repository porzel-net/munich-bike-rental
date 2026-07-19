"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { buildConsentCookieValue, type ConsentPreferences, type ConsentState } from "../lib/consent";
import { consentCopy } from "../lib/consent-copy";

type ConsentContextValue = {
  locale: "de" | "en";
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  openSettings: (trigger?: HTMLElement | null) => void;
  saveNecessaryOnly: () => void;
  saveAll: () => void;
  saveSelection: (preferences: ConsentPreferences) => void;
  trackLead: (payload: { bikeTitle?: string; language: "de" | "en"; contactMethod?: "email" | "other" }) => void;
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
    gtag?: (
      ...args: Array<
        string | number | boolean | (() => void) | Record<string, string | number | boolean | (() => void) | undefined>
      >
    ) => void;
  };

  return win.gtag;
}

function normalizeSearchLocale(searchParams: ReturnType<typeof useSearchParams>, fallback: "de" | "en") {
  return searchParams.get("lang") === "en" ? "en" : fallback;
}

function getBannerIntro(
  locale: "de" | "en",
  hasAnalyticsTracking: boolean,
  hasMarketingTracking: boolean,
  necessaryIntro: string,
) {
  if (locale === "de") {
    if (hasAnalyticsTracking && hasMarketingTracking) {
      return `${necessaryIntro} Mit Ihrer Zustimmung laden wir Google Analytics und Google Ads Conversion-Tracking zur Erfolgsmessung.`;
    }

    if (hasAnalyticsTracking) {
      return `${necessaryIntro} Mit Ihrer Zustimmung laden wir Google Analytics zur Erfolgsmessung.`;
    }

    if (hasMarketingTracking) {
      return `${necessaryIntro} Mit Ihrer Zustimmung laden wir Google Ads Conversion-Tracking zur Erfolgsmessung.`;
    }
  } else {
    if (hasAnalyticsTracking && hasMarketingTracking) {
      return `${necessaryIntro} With your consent we load Google Analytics and Google Ads conversion tracking for measurement.`;
    }

    if (hasAnalyticsTracking) {
      return `${necessaryIntro} With your consent we load Google Analytics for measurement.`;
    }

    if (hasMarketingTracking) {
      return `${necessaryIntro} With your consent we load Google Ads conversion tracking for measurement.`;
    }
  }

  return necessaryIntro;
}

export function useConsent() {
  const value = useContext(ConsentContext);

  if (!value) {
    return {
      locale: "de" as const,
      analyticsAllowed: false,
      marketingAllowed: false,
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
  const [googleTagReady, setGoogleTagReady] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(
    initialConsent
      ? { necessary: true, analytics: initialConsent.analytics, marketing: initialConsent.marketing }
      : { necessary: true, analytics: false, marketing: false },
  );
  const initialDialogFocusRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const hasGoogleAnalyticsTracking = Boolean(googleAnalyticsId);
  const hasGoogleAdsTracking = Boolean(googleAdsConversionId && googleAdsConversionLabel);
  const analyticsAllowed = Boolean(consent?.analytics && hasGoogleAnalyticsTracking);
  const marketingAllowed = Boolean(consent?.marketing && hasGoogleAdsTracking);
  const isConsentDialogOpen = panelOpen || !consent;
  const bannerIntro = getBannerIntro(locale, hasGoogleAnalyticsTracking, hasGoogleAdsTracking, copy.bannerIntro);

  useEffect(() => {
    if (!consent) {
      return;
    }

    writeConsentCookie({
      necessary: true,
      analytics: consent.analytics,
      marketing: consent.marketing,
    });
  }, [consent]);

  useEffect(() => {
    if (!isConsentDialogOpen) {
      const returnFocusTarget = returnFocusRef.current;
      returnFocusRef.current = null;

      window.requestAnimationFrame(() => {
        const focusTarget =
          returnFocusTarget && document.contains(returnFocusTarget) ? returnFocusTarget : settingsTriggerRef.current;
        focusTarget?.focus();
      });

      return;
    }

    const focusFrame = window.requestAnimationFrame(() => initialDialogFocusRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [isConsentDialogOpen]);

  useEffect(() => {
    if (!analyticsAllowed || !googleAnalyticsId || !googleTagReady) {
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
  }, [analyticsAllowed, googleAnalyticsId, googleTagReady, pathname, searchParams]);

  useEffect(() => {
    if (!googleTagReady) {
      return;
    }

    const gtag = getGtag();
    if (!gtag) {
      return;
    }

    gtag("consent", "update", {
      analytics_storage: analyticsAllowed ? "granted" : "denied",
      ad_storage: marketingAllowed ? "granted" : "denied",
      ad_user_data: marketingAllowed ? "granted" : "denied",
      ad_personalization: "denied",
    });

    if (analyticsAllowed && googleAnalyticsId) {
      gtag("config", googleAnalyticsId, {
        send_page_view: false,
        anonymize_ip: true,
        allow_google_signals: false,
      });
    }

    if (marketingAllowed && googleAdsConversionId) {
      gtag("config", googleAdsConversionId);
    }
  }, [analyticsAllowed, googleAdsConversionId, googleAnalyticsId, googleTagReady, marketingAllowed]);

  const openSettings = (trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDraft(
      consent
        ? { necessary: true, analytics: consent.analytics, marketing: consent.marketing }
        : { necessary: true, analytics: false, marketing: false },
    );
    setPanelOpen(true);
  };

  const saveNecessaryOnly = () => {
    const next: ConsentPreferences = { necessary: true, analytics: false, marketing: false };
    setConsent({ ...next, updatedAt: new Date().toISOString() });
    setDraft(next);
    setPanelOpen(false);
  };

  const saveAll = () => {
    const next: ConsentPreferences = {
      necessary: true,
      analytics: hasGoogleAnalyticsTracking,
      marketing: hasGoogleAdsTracking,
    };
    setConsent({ ...next, updatedAt: new Date().toISOString() });
    setDraft(next);
    setPanelOpen(false);
  };

  const saveSelection = (preferences: ConsentPreferences) => {
    const next: ConsentPreferences = {
      necessary: true,
      analytics: hasGoogleAnalyticsTracking && preferences.analytics,
      marketing: hasGoogleAdsTracking && preferences.marketing,
    };
    setConsent({ ...next, updatedAt: new Date().toISOString() });
    setDraft(next);
    setPanelOpen(false);
  };

  const closeSettings = () => {
    if (consent) {
      setDraft({ necessary: true, analytics: consent.analytics, marketing: consent.marketing });
      setPanelOpen(false);
      return;
    }

    saveNecessaryOnly();
  };

  const trackLead: ConsentContextValue["trackLead"] = ({ bikeTitle, language, contactMethod }) => {
    const gtag = getGtag();
    if (!gtag) {
      return;
    }

    if (analyticsAllowed) {
      gtag("event", "generate_lead", {
        event_category: "contact",
        event_label: bikeTitle || "contact_form",
        language,
        contact_method: contactMethod,
        page_location: window.location.href,
      });

      gtag("event", "conversion_event_submit_lead_form", {
        event_callback: () => undefined,
        event_timeout: 2000,
        event_category: "contact",
        event_label: bikeTitle || "contact_form",
        language,
        contact_method: contactMethod,
        page_location: window.location.href,
      });
    }

    if (marketingAllowed && googleAdsConversionId && googleAdsConversionLabel) {
      gtag("event", "conversion", {
        send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}`,
        value: 1,
        currency: "EUR",
        event_label: bikeTitle || "contact_form",
      });
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
      return;
    }
  };

  const value: ConsentContextValue = {
    locale,
    analyticsAllowed,
    marketingAllowed,
    openSettings,
    saveNecessaryOnly,
    saveAll,
    saveSelection,
    trackLead,
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}

      {analyticsAllowed || marketingAllowed ? (
        <>
          <Script id="google-tag-init" strategy="afterInteractive" nonce={nonce}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
            `}
          </Script>
          <Script
            id="google-tag-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId ?? googleAdsConversionId}`}
            strategy="afterInteractive"
            nonce={nonce}
            onLoad={() => setGoogleTagReady(true)}
          />
        </>
      ) : null}

      {isConsentDialogOpen ? (
        <div
          className="cookie-banner"
          role="dialog"
          aria-labelledby="cookie-banner-title"
          onKeyDown={handleDialogKeyDown}
        >
          <div className="cookie-banner__panel">
            <div className="cookie-banner__header">
              <div>
                <span className="cookie-banner__eyebrow">{copy.bannerTitle}</span>
                <h2 className="cookie-banner__title" id="cookie-banner-title">
                  {copy.bannerTitle}
                </h2>
              </div>
              <p className="cookie-banner__intro">{bannerIntro}</p>
            </div>

            <div className="cookie-banner__choices">
              <label className="cookie-banner__choice">
                <span className="cookie-banner__choice-copy">
                  <strong>{copy.necessaryTitle}</strong>
                  <span>{copy.necessaryText}</span>
                </span>
                <input type="checkbox" checked={draft.necessary} disabled aria-label={copy.necessaryTitle} />
              </label>

              {hasGoogleAnalyticsTracking ? (
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
              ) : null}

              {hasGoogleAdsTracking ? (
                <label className="cookie-banner__choice">
                  <span className="cookie-banner__choice-copy">
                    <strong>{copy.marketingTitle}</strong>
                    <span>{copy.marketingText}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.marketing}
                    onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))}
                    aria-label={copy.marketingTitle}
                  />
                </label>
              ) : null}
            </div>

            <div className="cookie-banner__actions">
              <button
                type="button"
                className="cookie-banner__button cookie-banner__button--ghost"
                onClick={saveNecessaryOnly}
                ref={initialDialogFocusRef}
              >
                {copy.acceptNecessary}
              </button>
              <button
                type="button"
                className="cookie-banner__button cookie-banner__button--ghost"
                onClick={() => saveSelection(draft)}
              >
                {copy.saveSelection}
              </button>
              <button type="button" className="cookie-banner__button cookie-banner__button--primary" onClick={saveAll}>
                {copy.acceptAll}
              </button>
            </div>

            <div className="cookie-banner__footer">
              <Link href="/datenschutzerklaerung" className="cookie-banner__link">
                {copy.privacyLink}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!panelOpen && consent ? (
        <button
          type="button"
          className="cookie-settings-trigger"
          onClick={(event) => openSettings(event.currentTarget)}
          ref={settingsTriggerRef}
        >
          {copy.settingsButton}
        </button>
      ) : null}
    </ConsentContext.Provider>
  );
}
