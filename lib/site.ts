const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persoenlicher Rennrad- und Gravelbike-Verleih in Muenchen-Maxvorstadt mit gepflegten Bikes, direktem Kontakt, klaren Tarifen und Fokus auf sportliche Touren.",
  descriptionEn:
    "Personal road and gravel bike rental in Munich-Maxvorstadt with well-maintained bikes, direct contact and clear pricing.",
  email: "hallo@munich-bike-rental.de",
  phone: "+49 152 51330962",
  phoneE164: "+4915251330962",
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
  title: "Rennrad- und Gravelbike-Verleih München",
  titleTemplate: "%s | Munich Rental",
};
