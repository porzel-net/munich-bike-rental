import type { Locale } from "./home-content";
import type { BlogPost } from "./blog-content";
import { getBlogImageSrc, getBlogPostPlainText } from "./blog-content";
import { siteConfig } from "./site";

const offerCatalog = [
  {
    "@type": "Offer",
    position: 1,
    name: "Endurace CF SL 8 Di2",
    description: "Ausgewogenes Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
    price: 59,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
  {
    "@type": "Offer",
    position: 2,
    name: "Grail CF SL 7",
    description: "Carbon-Gravelbike mit GRX 800, Shimano GRX 600 hydraulischen Scheibenbremsen, DT Swiss GR1600 Spline Laufrädern und Schwalbe G-One R Evo Reifen für gemischte Strecken und längere Ausfahrten.",
    price: 59,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
  {
    "@type": "Offer",
    position: 3,
    name: "Ultimate CF SL 7 eTap AXS",
    description: "Leichtes Allround-Rad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
    price: 59,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
  {
    "@type": "Offer",
    position: 4,
    name: "Aeroad CF SL 8 Disc",
    description: "Aero-Bike für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
    price: 79,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
];

const faqEntries = [
  {
    "@type": "Question",
    name: "Wie läuft die Anfrage und Miete ab?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Alle Fahrräder können online über das Kontaktfeld angefragt und gemietet werden. Wir klären anschließend alles direkt per E-Mail oder WhatsApp und melden uns immer innerhalb von 24 Stunden, damit am Ende Preis, Zeitraum und Abholung sauber passen.",
    },
  },
  {
    "@type": "Question",
    name: "Wo werden die Fahrräder abgeholt?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Die Abholung findet vor Ort in München-Maxvorstadt statt. Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.",
    },
  },
  {
    "@type": "Question",
    name: "Sind die Fahrräder versichert?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Ja, alle Fahrräder sind über eine gewerbliche Versicherung abgesichert. Die Versicherung umfasst Diebstahl, Schäden und Zerstörung.",
    },
  },
  {
    "@type": "Question",
    name: "Was passiert, wenn etwas beschädigt wird?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Auch in diesem Fall bist du nicht allein. Wir arbeiten mit einer gewerblichen Versicherung, damit Diebstahl, Schäden und Zerstörung abgesichert sind und wir gemeinsam eine saubere Lösung haben.",
    },
  },
];

export function getHomeStructuredDataJson() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: siteConfig.name,
        description: siteConfig.description,
        url: siteConfig.url,
        telephone: siteConfig.phoneE164,
        email: siteConfig.email,
        image: `${siteConfig.url}/assets/img/hero/1.jpg`,
        priceRange: siteConfig.priceRange,
        areaServed: siteConfig.areaServed,
        serviceType: "Rennrad- und Gravelbike-Verleih",
        address: {
          "@type": "PostalAddress",
          streetAddress: siteConfig.address.streetAddress,
          postalCode: siteConfig.address.postalCode,
          addressLocality: siteConfig.address.addressLocality,
          addressRegion: siteConfig.address.addressRegion,
          addressCountry: siteConfig.address.addressCountry,
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Rennradverleih Angebote",
          itemListElement: offerCatalog,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqEntries,
      },
    ],
  });
}

export function getBlogPostStructuredDataJson(post: BlogPost, locale: Locale) {
  const title = post.title[locale];
  const description = post.excerpt[locale];
  const articleBody = getBlogPostPlainText(post, locale);
  const language = locale === "de" ? "de-DE" : "en-US";
  const url = `${siteConfig.url}/blog/${post.slug}`;

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: locale === "de" ? "Startseite" : "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: locale === "de" ? "Blog" : "Blog",
            item: `${siteConfig.url}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: url,
          },
        ],
      },
      {
        "@type": "BlogPosting",
        headline: title,
        description,
        articleSection: post.category[locale],
        inLanguage: language,
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        image: `${siteConfig.url}${getBlogImageSrc(post.heroImage)}`,
        author: {
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
        },
        publisher: {
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
          logo: {
            "@type": "ImageObject",
            url: `${siteConfig.url}/favicon.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url,
        },
        url,
        keywords: [
          "Rennradtouren München",
          "Rennrad München",
          "Touren rund um München",
          "Fünfseenland",
          "Starnberger See",
        ],
        wordCount: articleBody.split(/\s+/).filter(Boolean).length,
        articleBody,
      },
    ],
  });
}
