const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persoenlicher Bike-Verleih in Muenchen-Maxvorstadt mit eigenen Endurance-, Gravel-, Allround- und Aero-Bikes, direktem Kontakt und klaren Preisen.",
  descriptionEn:
    "Personal bike rental in Munich-Maxvorstadt with owned endurance, gravel, all-round and aero bikes, direct contact and clear pricing.",
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
  title: "Rennrad-, Gravel- und Aero-Bike-Verleih München",
  titleTemplate: "%s | Munich Rental",
};
