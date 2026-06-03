const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persoenlicher Rennradverleih in Muenchen-Maxvorstadt mit gepflegten Rennraedern, direktem Kontakt, klaren Tarifen und Fokus auf sportliche Rennraeder.",
  descriptionEn:
    "Personal road bike rental in Munich-Maxvorstadt with well-maintained road bikes, direct contact and clear pricing.",
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
  priceRange: "39 EUR-80 EUR",
  locale: "de_DE",
  title: "Rennradverleih München",
  titleTemplate: "%s | Munich Rental",
};
