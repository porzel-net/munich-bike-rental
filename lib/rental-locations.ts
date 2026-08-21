import type { Locale } from "./home-content";
import type { RentalLocation } from "./inquiries/catalog";

export type RentalLocationConfig = {
  key: RentalLocation;
  citySlug: string;
  districtSlug: string;
  path: string;
  enPath: string;
  legacyPath: string;
  city: Record<Locale, string>;
  district: Record<Locale, string>;
  address: string;
  streetAddress: string;
  postalCode: string;
  mapImage: string;
  mapsUrl: string;
  pickupNote?: Record<Locale, string>;
};

export const rentalLocationConfigs = [
  {
    key: "munich",
    citySlug: "münchen",
    districtSlug: "maxvorstadt",
    path: "/de/rennradverleih/münchen/maxvorstadt",
    enPath: "/en/rennradverleih/münchen/maxvorstadt",
    legacyPath: "/rennradverleih/münchen/maxvorstadt",
    city: { de: "München", en: "Munich" },
    district: { de: "Maxvorstadt", en: "Maxvorstadt" },
    address: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
    streetAddress: "Gabelsbergerstraße 79a",
    postalCode: "80333",
    mapImage: "/assets/img/location/munich-maps.webp",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gabelsbergerstra%C3%9Fe+79a%2C+80333+M%C3%BCnchen",
    pickupNote: { de: "Danach bei +49 152 51330962 anrufen.", en: "Then call +49 152 51330962." },
  },
  {
    key: "regensburg",
    citySlug: "regensburg",
    districtSlug: "altstadt",
    path: "/de/rennradverleih/regensburg/altstadt",
    enPath: "/en/rennradverleih/regensburg/altstadt",
    legacyPath: "/rennradverleih/regensburg/altstadt",
    city: { de: "Regensburg", en: "Regensburg" },
    district: { de: "Altstadt", en: "Old Town" },
    address: "Rote Hahnen Gasse 12, 93047 Regensburg, Altstadt",
    streetAddress: "Rote Hahnen Gasse 12",
    postalCode: "93047",
    mapImage: "/assets/img/location/regensburg-maps.webp",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rote+Hahnen+Gasse+12%2C+93047+Regensburg",
    pickupNote: {
      de: "Danach bei Baiersdorfer/Reitinger klingeln und unten warten.",
      en: "Then ring Baiersdorfer/Reitinger and wait downstairs.",
    },
  },
  {
    key: "lindau",
    citySlug: "lindau",
    districtSlug: "aeschach",
    path: "/de/rennradverleih/lindau/aeschach",
    enPath: "/en/rennradverleih/lindau/aeschach",
    legacyPath: "/rennradverleih/lindau/aeschach",
    city: { de: "Lindau Bodensee", en: "Lindau (Lake Constance)" },
    district: { de: "Aeschach", en: "Aeschach" },
    address: "Lärchenweg 3a, 88131 Lindau Bodensee-Aeschach",
    streetAddress: "Lärchenweg 3a",
    postalCode: "88131",
    mapImage: "/assets/img/location/lindau-maps.webp",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=L%C3%A4rchenweg+3a%2C+88131+Lindau",
  },
  {
    key: "friedrichshafen",
    citySlug: "friedrichshafen",
    districtSlug: "innenstadt",
    path: "/de/rennradverleih/friedrichshafen/innenstadt",
    enPath: "/en/rennradverleih/friedrichshafen/innenstadt",
    legacyPath: "/rennradverleih/friedrichshafen/innenstadt",
    city: { de: "Friedrichshafen", en: "Friedrichshafen" },
    district: { de: "Innenstadt", en: "City Centre" },
    address: "Katharinenstraße 2/3, 88045 Friedrichshafen",
    streetAddress: "Katharinenstraße 2/3",
    postalCode: "88045",
    mapImage: "/assets/img/location/friedrichshafen-maps.webp",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Katharinenstra%C3%9Fe+2%2F3%2C+88045+Friedrichshafen",
  },
  {
    key: "konstanz",
    citySlug: "konstanz",
    districtSlug: "altstadt",
    path: "/de/rennradverleih/konstanz/altstadt",
    enPath: "/en/rennradverleih/konstanz/altstadt",
    legacyPath: "/rennradverleih/konstanz/altstadt",
    city: { de: "Konstanz", en: "Constance" },
    district: { de: "Altstadt", en: "Old Town" },
    address: "Wessenbergstraße 12, 78462 Konstanz-Altstadt",
    streetAddress: "Wessenbergstraße 12",
    postalCode: "78462",
    mapImage: "/assets/img/location/konstanz-maps.webp",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Wessenbergstra%C3%9Fe+12%2C+78462+Konstanz",
  },
] as const satisfies readonly RentalLocationConfig[];

export const defaultRentalLocation = rentalLocationConfigs[0];

export function getLocalizedLocationPath(location: RentalLocationConfig, locale: Locale) {
  return locale === "en" ? location.enPath : location.path;
}

export function getRentalLocation(city: string, district: string) {
  const decodeSegment = (segment: string) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  };

  const decodedCity = decodeSegment(city);
  const decodedDistrict = decodeSegment(district);

  return rentalLocationConfigs.find(
    (location) => location.citySlug === decodedCity && location.districtSlug === decodedDistrict,
  );
}

export function getLocationCopy(location: RentalLocationConfig, locale: Locale) {
  const city = location.city[locale];
  const district = location.district[locale];

  if (locale === "en") {
    return {
      heroTitle: `Canyon Carbon Road & Gravel Bike Rental in ${city}`,
      heroIntro: `Personal road and gravel bike rental in ${city} ${district}: serviced endurance, gravel, all-round and aero bikes for training, weekend rides and longer tours. You get direct contact, honest advice and transparent rates instead of anonymous mass rental.`,
      priceIntro: `Clear prices for your bike rental in ${city}: road bikes from €49, with discounts on top. Accessories from €0.`,
      pricePromise: `If you find a comparable road bike in ${city} with similar equipment for less elsewhere, you get the better price with us.`,
      locationTitle: `Bike rental in ${city} ${district}`,
      locationIntro: `Pick up your road or gravel bike directly in ${city} ${district}. After your request, we will coordinate the exact handover with you by email.`,
      locationNotice: "We only hand out bikes; there is no storefront.",
      locationLabel: `${city} ${district} address`,
      faqPickup: `Bike pickup takes place directly in ${city} ${district}. We hand over the bike on site and adjust it to your needs, for example the saddle position. We will coordinate the exact process with you by email after your request.`,
      aboutRental: `We are a personal bike rental in ${city} and rent out only our own endurance, gravel, all-round and aero bikes, so every bike is ready to ride right away.`,
      blogIntro: `Short, practical insights about road bikes, fit and routes in and around ${city}.`,
      insuranceProtectionInfo: {
        lead: "Your protection matters to us.",
        body: `We are one of the few road-bike rental companies in ${city} to offer insurance protection, unlike almost all other rental providers.`,
        savings:
          "For damage caused by you, you pay no more than €100 instead of the full cost of the damage. If the bike is lost, you pay no more than €300 instead of replacing the entire bike.",
        footer: "Normal wear and tear from proper use is not charged to you.",
      },
    };
  }

  return {
    heroTitle: `Canyon Carbon Rennrad & Gravel-Verleih ${city}`,
    heroIntro: `Persönlicher Rennrad- und Gravel-Verleih in ${city}-${district}: gepflegte Endurance-, Gravel-, Allround- und Aero-Bikes für Training, Wochenendausfahrten und längere Touren. Statt Massenverleih bekommst du bei uns direkten Kontakt, ehrliche Beratung und klare Tarife.`,
    priceIntro: `Klare Preise für deinen Bike-Verleih in ${city}: Rennräder ab 49€ plus Rabatte obendrauf. Zubehör ab 0€.`,
    pricePromise: `Findest du in ${city} ein vergleichbares Rennrad mit ähnlicher Ausstattung günstiger, bekommst du bei uns den besseren Preis.`,
    locationTitle: `Rennradverleih in ${city}-${district}`,
    locationIntro: `Hole dein Rennrad oder Gravelbike direkt in ${city}-${district} ab. Den genauen Ablauf der Übergabe stimmen wir nach deiner Anfrage per E-Mail mit dir ab.`,
    locationNotice: "Wir geben nur raus, es gibt keine Ladenfläche",
    locationLabel: `Adresse ${city}`,
    faqPickup: `Die Abholung findet direkt in ${city}-${district} statt. Vor Ort geben wir dir das Fahrrad heraus und passen es auf deine Wünsche an, zum Beispiel die Sitzposition. Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.`,
    aboutRental: `Wir sind ein persönlicher Bike-Verleih in ${city} und verleihen ausschließlich unsere eigenen Endurance-, Gravel-, Allround- und Aero-Bikes, damit jedes Rad sofort startklar ist.`,
    blogIntro: `Kurze, praktische Einblicke rund um Rennrad, Passform und Touren in und um ${city}.`,
    insuranceProtectionInfo: {
      lead: "Dein Schutz ist uns wichtig.",
      body: `Wir gehören zu den wenigen Rennradverleihern in ${city}, die – anders als fast alle Verleiher – Versicherungsschutz anbieten.`,
      savings:
        "Bei einem von dir verursachten Schaden zahlst du höchstens 100 € – statt für den gesamten Schaden aufzukommen. Bei Verlust zahlst du höchstens 300 € – statt das komplette Fahrrad ersetzen zu müssen.",
      footer: "Normale, bestimmungsgemäße Gebrauchsspuren und üblicher Verschleiß werden dir nicht berechnet.",
    },
  };
}
