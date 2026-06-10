export type ConsentCopy = {
  bannerTitle: string;
  bannerIntro: string;
  necessaryTitle: string;
  necessaryText: string;
  analyticsTitle: string;
  analyticsText: string;
  acceptNecessary: string;
  saveSelection: string;
  acceptAll: string;
  settingsButton: string;
  privacyLink: string;
};

export const consentCopy: Record<"de" | "en", ConsentCopy> = {
  de: {
    bannerTitle: "Cookies und externe Inhalte",
    bannerIntro:
      "Wir verwenden technisch notwendige Cookies für den Betrieb der Seite. Mit deiner Zustimmung laden wir Google Analytics für die Erfolgsmessung.",
    necessaryTitle: "Notwendig",
    necessaryText: "Speichert nur die Einstellungen, die für die Funktion dieser Seite erforderlich sind.",
    analyticsTitle: "Google Analytics",
    analyticsText: "Hilft uns zu verstehen, welche Seiten und Anfragen gut funktionieren. Wird erst nach Zustimmung geladen.",
    acceptNecessary: "Nur notwendige akzeptieren",
    saveSelection: "Auswahl speichern",
    acceptAll: "Alle akzeptieren",
    settingsButton: "Cookie-Einstellungen",
    privacyLink: "Zur Datenschutzerklärung",
  },
  en: {
    bannerTitle: "Cookies and external content",
    bannerIntro:
      "We use strictly necessary cookies for the site to work. With your consent we load Google Analytics for measurement.",
    necessaryTitle: "Necessary",
    necessaryText: "Stores only the settings required for the site to function.",
    analyticsTitle: "Google Analytics",
    analyticsText: "Helps us understand which pages and inquiries work well. Loaded only after consent.",
    acceptNecessary: "Necessary only",
    saveSelection: "Save selection",
    acceptAll: "Accept all",
    settingsButton: "Cookie settings",
    privacyLink: "To the privacy policy",
  },
};
