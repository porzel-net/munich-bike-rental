import type { Metadata } from "next";

import HomePage from "../page";
import { resolveLocale } from "../../lib/home-content";
import { siteConfig } from "../../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const isGerman = lang === "de";

  const title = isGerman ? "Rennrad-, Gravel-Verleih in München" : "Road and gravel bike rental in Munich";
  const description = isGerman
    ? "Persönlicher Rennrad- und Gravel-Verleih in München-Maxvorstadt mit gepflegten Rädern, direkter Anfrage, Beratung und fairen Preisen."
    : "Personal road and gravel bike rental in Munich-Maxvorstadt with serviced bikes, direct inquiry, advice and fair pricing.";

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    alternates: {
      canonical: "/",
      languages: {
        de: "/",
        en: "/?lang=en",
      },
    },
    robots: {
      index: false,
      follow: true,
    },
    keywords: isGerman
      ? [
          "Rennradverleih München",
          "Gravelbike Verleih München",
          "Rennrad mieten München",
          "Gravelbike mieten München",
          "Bike rental Munich",
          "Rennrad Maxvorstadt",
          "Gravelbike Maxvorstadt",
          "Bike hire Munich",
          "Road bike rental Munich",
        ]
      : [
          "road bike rental Munich",
          "gravel bike rental Munich",
          "road bike hire Munich",
          "bike rental Munich",
          "road bike maintenance Munich",
          "gravel bike maintenance Munich",
        ],
    openGraph: {
      type: "website",
      locale: isGerman ? "de_DE" : "en_US",
      url: isGerman ? siteConfig.url : `${siteConfig.url}/?lang=en`,
      siteName: siteConfig.name,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: isGerman
            ? "Munich Rental - Rennrad- und Gravel-Verleih in München"
            : "Munich Rental - road and gravel bike rental in Munich",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function MuenchenPage({ searchParams }: PageProps) {
  return <HomePage searchParams={searchParams} defaultLocation="munich" focusCity="munich" />;
}
