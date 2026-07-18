const siteUrl = process.env.SITE_URL ?? "https://www.munich-bike-rental.de";

export const siteConfig = {
  name: "Munich Rental",
  url: siteUrl,
  description:
    "Persönlicher Rennrad- und Gravel-Verleih in München, Regensburg, Lindau Bodensee, Friedrichshafen und Konstanz. Gepflegte Räder, direkte Beratung und klare Preise.",
  descriptionEn:
    "Personal road and gravel bike rental in Munich, Regensburg, Lindau, Friedrichshafen and Constance with serviced bikes, direct advice and transparent pricing.",
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
  areaServed: [
    "München",
    "München-Maxvorstadt",
    "Regensburg",
    "Regensburg-Altstadt",
    "Lindau Bodensee",
    "Friedrichshafen",
    "Konstanz",
    "Bayern",
  ],
  priceRange: "59 EUR-79 EUR",
  locale: "de_DE",
  title: "Rennrad- & Gravelbike-Verleih in München, Regensburg & am Bodensee | Your Bike Rental",
  titleTemplate: "%s | Your Bike Rental",
};
