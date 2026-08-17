import type { Locale } from "../home-content";

export const rentalLocations = ["munich", "regensburg", "lindau", "friedrichshafen", "konstanz"] as const;
export type RentalLocation = (typeof rentalLocations)[number];

export const rentalLocationLabels: Record<Locale, Record<RentalLocation, string>> = {
  de: {
    munich: "München",
    regensburg: "Regensburg",
    lindau: "Lindau Bodensee",
    friedrichshafen: "Friedrichshafen",
    konstanz: "Konstanz",
  },
  en: {
    munich: "Munich",
    regensburg: "Regensburg",
    lindau: "Lindau (Lake Constance)",
    friedrichshafen: "Friedrichshafen",
    konstanz: "Constance",
  },
};

export const bikeOptionsByLocation = {
  munich: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
    "Ultimate CF SL 7 - M",
    "Ultimate CF SL 7 - L",
    "Aeroad CF SL 8 - S",
    "Aeroad CF SL 8 - M",
  ],
  regensburg: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
  ],
  lindau: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
  ],
  friedrichshafen: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
  ],
  konstanz: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
  ],
} as const satisfies Record<RentalLocation, readonly string[]>;

export const rentalBikeOptions = [...new Set(Object.values(bikeOptionsByLocation).flat())] as [string, ...string[]];

export const pedalTypes = ["platform", "spdSl", "lookKeo2Max", "other"] as const;
export const computerMountTypes = ["garmin", "wahoo", "other"] as const;
export const pedalTypeLabels = {
  de: { platform: "Plattformpedale", spdSl: "SPD-SL", lookKeo2Max: "Look Keo2 Max", other: "Andere" },
  en: { platform: "Platform pedals", spdSl: "SPD-SL", lookKeo2Max: "Look Keo2 Max", other: "Other" },
} as const;

export const computerMountTypeLabels = {
  de: { garmin: "Garmin", wahoo: "Wahoo", other: "Andere" },
  en: { garmin: "Garmin", wahoo: "Wahoo", other: "Other" },
} as const;

const pedalTypeAliases: Record<string, keyof typeof pedalTypeLabels.de> = {
  platform: "platform",
  flat: "platform",
  spd: "spdSl",
  spdsl: "spdSl",
  "spd-sl": "spdSl",
  lookkeo: "lookKeo2Max",
  lookkeo2max: "lookKeo2Max",
  "look-keo-2-max": "lookKeo2Max",
  other: "other",
  unknown: "other",
};

const computerMountTypeAliases: Record<string, keyof typeof computerMountTypeLabels.de> = {
  garmin: "garmin",
  wahoo: "wahoo",
  other: "other",
  unknown: "other",
};

/** Converts legacy/imported pedal values to the inventory's canonical keys. */
export function normalizePedalType(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return pedalTypeAliases[value.trim().toLowerCase()] ?? value.trim();
}

/** Converts legacy/imported computer mount values to the inventory's canonical keys. */
export function normalizeComputerMountType(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return computerMountTypeAliases[value.trim().toLowerCase()] ?? value.trim();
}

export function getPedalTypeLabel(value: string | null | undefined, locale: Locale) {
  if (!value) return "";
  const normalized = normalizePedalType(value);
  const key = normalized && normalized in pedalTypeLabels[locale] ? normalized : "other";
  return pedalTypeLabels[locale][key];
}

export function getComputerMountTypeLabel(value: string | null | undefined, locale: Locale) {
  if (!value) return "";
  const normalized = normalizeComputerMountType(value);
  const key = normalized && normalized in computerMountTypeLabels[locale] ? normalized : "other";
  return computerMountTypeLabels[locale][key];
}
