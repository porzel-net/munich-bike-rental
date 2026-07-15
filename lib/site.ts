const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persoenlicher Rennrad- und Gravel-Verleih sowie Wartung in Muenchen-Maxvorstadt und Regensburg-Altstadt. Gepflegte Raeder, Beratung, Reparaturen und Oel-zu-Wachs-Umstieg.",
  descriptionEn:
    "Personal road and gravel bike rental and maintenance in Munich-Maxvorstadt and Regensburg-Altstadt with serviced bikes, advice, repairs and oil-to-wax conversion.",
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
  areaServed: ["Muenchen", "Maxvorstadt", "Regensburg", "Regensburg-Altstadt", "Bayern"],
  priceRange: "59 EUR-79 EUR",
  locale: "de_DE",
  title: "Rennrad- & Gravelbike-Verleih München & Regensburg | Your Bike Rental",
  titleTemplate: "%s | Your Bike Rental",
};
