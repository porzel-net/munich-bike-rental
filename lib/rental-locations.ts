import type { Locale } from "./home-content";
import type { RentalLocation } from "./inquiries/catalog";

export type RentalLocationConfig = {
  key: RentalLocation;
  citySlug: string;
  districtSlug: string;
  path: string;
  city: Record<Locale, string>;
  district: Record<Locale, string>;
  address: string;
  streetAddress: string;
  postalCode: string;
  mapImage: string;
  mapsUrl: string;
};

export const rentalLocationConfigs = [
  {
    key: "munich",
    citySlug: "münchen",
    districtSlug: "maxvorstadt",
    path: "/rennradverleih/münchen/maxvorstadt",
    city: { de: "München", en: "Munich" },
    district: { de: "Maxvorstadt", en: "Maxvorstadt" },
    address: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
    streetAddress: "Gabelsbergerstraße 79a",
    postalCode: "80333",
    mapImage: "/assets/img/location/munich-maps.png",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gabelsbergerstra%C3%9Fe+79a%2C+80333+M%C3%BCnchen",
  },
  {
    key: "regensburg",
    citySlug: "regensburg",
    districtSlug: "altstadt",
    path: "/rennradverleih/regensburg/altstadt",
    city: { de: "Regensburg", en: "Regensburg" },
    district: { de: "Altstadt", en: "Old Town" },
    address: "Rote Hahnen Gasse 12, 93047 Regensburg, Altstadt",
    streetAddress: "Rote Hahnen Gasse 12",
    postalCode: "93047",
    mapImage: "/assets/img/location/regensburg-maps.png",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rote+Hahnen+Gasse+12%2C+93047+Regensburg",
  },
  {
    key: "lindau",
    citySlug: "lindau",
    districtSlug: "aeschach",
    path: "/rennradverleih/lindau/aeschach",
    city: { de: "Lindau Bodensee", en: "Lindau (Lake Constance)" },
    district: { de: "Aeschach", en: "Aeschach" },
    address: "Lärchenweg 3a, 88131 Lindau Bodensee-Aeschach",
    streetAddress: "Lärchenweg 3a",
    postalCode: "88131",
    mapImage: "/assets/img/location/lindau-maps.png",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=L%C3%A4rchenweg+3a%2C+88131+Lindau",
  },
  {
    key: "friedrichshafen",
    citySlug: "friedrichshafen",
    districtSlug: "innenstadt",
    path: "/rennradverleih/friedrichshafen/innenstadt",
    city: { de: "Friedrichshafen", en: "Friedrichshafen" },
    district: { de: "Innenstadt", en: "City Centre" },
    address: "Katharinenstraße 2/3, 88045 Friedrichshafen",
    streetAddress: "Katharinenstraße 2/3",
    postalCode: "88045",
    mapImage: "/assets/img/location/friedrichshafen-maps.png",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Katharinenstra%C3%9Fe+2%2F3%2C+88045+Friedrichshafen",
  },
  {
    key: "konstanz",
    citySlug: "konstanz",
    districtSlug: "altstadt",
    path: "/rennradverleih/konstanz/altstadt",
    city: { de: "Konstanz", en: "Constance" },
    district: { de: "Altstadt", en: "Old Town" },
    address: "Wessenbergstraße 12, 78462 Konstanz-Altstadt",
    streetAddress: "Wessenbergstraße 12",
    postalCode: "78462",
    mapImage: "/assets/img/location/konstanz-maps.png",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Wessenbergstra%C3%9Fe+12%2C+78462+Konstanz",
  },
] as const satisfies readonly RentalLocationConfig[];

export const defaultRentalLocation = rentalLocationConfigs[0];

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
      heroTitle: `ROAD & GRAVEL BIKE RENTAL ${city.toUpperCase()}`,
      heroIntro: `Personal road and gravel bike rental in ${city} ${district}: serviced endurance, gravel, all-round and aero bikes for training, weekend rides and longer tours. You get direct contact, honest advice and transparent rates instead of anonymous mass rental.`,
      priceIntro: `Clear prices for your bike rental in ${city}, plus Mon-Thu, long-rental and student discounts as well as accessories from 5€.`,
      pricePromise: `If you find a comparable road bike in ${city} with similar equipment for less elsewhere, you get the better price with us.`,
      locationTitle: `Bike rental in ${city} ${district}`,
      locationIntro: `Pick up your road or gravel bike directly in ${city} ${district}. After your request, we will coordinate the exact handover with you by email.`,
      locationNotice: "We only hand out bikes; there is no storefront.",
      locationLabel: `${city} ${district} address`,
      faqPickup: `Bike pickup takes place directly in ${city} ${district}. We hand over the bike on site and adjust it to your needs, for example the saddle position. We will coordinate the exact process with you by email after your request.`,
      maintenanceTitle: `Want to have your road or gravel bike serviced in ${city}?`,
      maintenanceText: `For an oil-to-wax conversion or a small service, you can send us a maintenance request here.`,
      aboutRental: `We are a personal bike rental in ${city} and rent out only our own endurance, gravel, all-round and aero bikes, so every bike is ready to ride right away.`,
      blogIntro: `Short, practical insights about road bikes, fit and routes in and around ${city}.`,
    };
  }

  return {
    heroTitle: `RENNRAD-, GRAVEL-VERLEIH ${city.toUpperCase()}`,
    heroIntro: `Persönlicher Rennrad- und Gravel-Verleih in ${city}-${district}: gepflegte Endurance-, Gravel-, Allround- und Aero-Bikes für Training, Wochenendausfahrten und längere Touren. Statt Massenverleih bekommst du bei uns direkten Kontakt, ehrliche Beratung und klare Tarife.`,
    priceIntro: `Klare Preise für deinen Bike-Verleih in ${city}, dazu Mo-Do-Rabatt, Langzeitrabatt und Studentenrabatt sowie Zubehör ab 5€.`,
    pricePromise: `Findest du in ${city} ein vergleichbares Rennrad mit ähnlicher Ausstattung günstiger, bekommst du bei uns den besseren Preis.`,
    locationTitle: `Rennradverleih in ${city}-${district}`,
    locationIntro: `Hole dein Rennrad oder Gravelbike direkt in ${city}-${district} ab. Den genauen Ablauf der Übergabe stimmen wir nach deiner Anfrage per E-Mail mit dir ab.`,
    locationNotice: "Wir geben nur raus, es gibt keine Ladenfläche",
    locationLabel: `Adresse ${city}`,
    faqPickup: `Die Abholung findet direkt in ${city}-${district} statt. Vor Ort geben wir dir das Fahrrad heraus und passen es auf deine Wünsche an, zum Beispiel die Sitzposition. Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.`,
    maintenanceTitle: `Willst du dein Rennrad oder Gravelbike in ${city} warten lassen?`,
    maintenanceText: `Wenn du zum Beispiel von Öl auf Wachs wechseln möchtest oder einen kleinen Service brauchst, geht es hier zur Wartung.`,
    aboutRental: `Wir sind ein persönlicher Bike-Verleih in ${city} und verleihen ausschließlich unsere eigenen Endurance-, Gravel-, Allround- und Aero-Bikes, damit jedes Rad sofort startklar ist.`,
    blogIntro: `Kurze, praktische Einblicke rund um Rennrad, Passform und Touren in und um ${city}.`,
  };
}
