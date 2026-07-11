import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";
import { ConsentProvider } from "../components/consent-manager";
import { parseConsentCookie } from "../lib/consent";
import { getHomeStructuredDataJson } from "../lib/structured-data";
import { resolveLocale } from "../lib/home-content";
import { siteConfig } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  applicationName: siteConfig.name,
  keywords: [
    "Fahrradverleih München",
    "Rennradverleih München",
    "Rennrad verleih München",
    "Rennradverleih Muenchen",
    "Rennrad mieten München",
    "Rennrad mieten Muenchen",
    "Rennrad leihen München",
    "Rennrad ausleihen München",
    "Rennrad München mieten",
    "Rennräder mieten München",
    "Rennraeder mieten Muenchen",
    "Gravelbike mieten München",
    "Gravelbike verleih München",
    "Gravelbike leihen München",
    "Gravel bike mieten München",
    "Gravel bike rental Munich",
    "Bike rental Munich",
    "Bike hire Munich",
    "Bike rental Maxvorstadt",
    "Rennradverleih Maxvorstadt",
    "Rennradverleih München Maxvorstadt",
    "Carbon Rennrad mieten",
    "Carbon Rennräder München",
    "Aero Rennrad mieten München",
    "Fahrradwartung München",
    "Rennrad Wartung München",
    "Gravelbike Wartung München",
    "Öl auf Wachs München",
    "Fahrrad reparieren München",
    "Endurace CF SL 8 Di2",
    "Shimano 105 Di2",
    "Grail CF SL 7",
    "Ultimate CF SL 7 eTap AXS",
    "Aeroad CF SL 8 Disc",
    "Bike maintenance Munich",
    "Road bike maintenance Munich",
    "Gravel bike maintenance Munich",
    "Road bike rental Munich",
    "Road bike hire Munich",
    "Road bikes Munich",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - Rennrad-, Gravel- und Aero-Bike-Verleih in München`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const pathname = requestHeaders.get("x-pathname");
  const searchParams = new URLSearchParams(requestHeaders.get("x-search") ?? "");
  const locale = resolveLocale(searchParams.get("lang") ?? undefined);
  const initialConsent = parseConsentCookie(requestHeaders.get("cookie"));
  const structuredDataJson = pathname === "/" ? getHomeStructuredDataJson() : null;
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-RSPEH19Q6Y";
  const googleAdsConversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? "";
  const googleAdsConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? "";

  return (
    <html lang={locale}>
      <body>
        {structuredDataJson ? (
          <script
            nonce={nonce}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: structuredDataJson }}
          />
        ) : null}
        <ConsentProvider
          initialConsent={initialConsent}
          initialLocale={locale}
          nonce={nonce}
          googleAnalyticsId={googleAnalyticsId}
          googleAdsConversionId={googleAdsConversionId}
          googleAdsConversionLabel={googleAdsConversionLabel}
        >
          {children}
        </ConsentProvider>
      </body>
    </html>
  );
}
