const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persoenlicher Rennrad- und Gravelbike-Verleih sowie Wartung in Muenchen-Maxvorstadt. Rennrad leihen, Gravelbike mieten und direkt vor Ort beraten lassen.",
  descriptionEn:
    "Personal road bike and gravel bike rental and maintenance in Munich-Maxvorstadt with owned bikes, direct contact and clear pricing.",
  email: "hallo@munich-bike-rental.de",
  phone: "+49 89 54193577",
  phoneE164: "+498954193577",
  address: {
    streetAddress: "Josephine-Lang-Weg 3",
    postalCode: "81245",
    addressLocality: "Muenchen",
    addressRegion: "Bayern",
    addressCountry: "DE",
  },
  areaServed: ["Muenchen", "Maxvorstadt", "Bayern"],
  priceRange: "59 EUR-79 EUR",
  locale: "de_DE",
  title: "Rennrad- & Gravelbike-Verleih & Wartung München",
  titleTemplate: "%s | Munich Rental",
};
