import { siteConfig } from "./site";

const offerCatalog = [
  {
    "@type": "Offer",
    position: 1,
    name: "Endurace CF SL 8 Di2",
    description: "Ausgewogenes Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
    price: 39,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
  {
    "@type": "Offer",
    position: 2,
    name: "Ultimate CF SL 7 eTap AXS",
    description: "Leichtes Allround-Rad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
    price: 45,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
  {
    "@type": "Offer",
    position: 3,
    name: "Aeroad CF SL 8 Disc",
    description: "Aero-Bike für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
    price: 80,
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
      text: "Alle Fahrräder können online angefragt und gemietet werden. Wir klären anschließend alles per E-Mail, WhatsApp oder Telefon, damit am Ende Preis, Zeitraum und Abholung sauber passen.",
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
        serviceType: "Rennradverleih",
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
