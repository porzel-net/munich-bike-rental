import type { Locale } from "../home-content";

export const rentalLocations = ["munich", "regensburg"] as const;
export type RentalLocation = (typeof rentalLocations)[number];

export const rentalLocationLabels: Record<Locale, Record<RentalLocation, string>> = {
  de: { munich: "München", regensburg: "Regensburg" },
  en: { munich: "Munich", regensburg: "Regensburg" },
};

export const bikeOptionsByLocation = {
  munich: [
    "Endurace CF SL 8 - XS",
    "Endurace CF SL 8 - S",
    "Endurace CF SL 8 - M",
    "Endurace CF SL 8 - L",
    "Grail CF SL 7 - S",
    "Grail CF SL 7 - M",
    "Grail CF SL 7 - L",
    "Ultimate CF SL 7 eTap AXS - M",
    "Ultimate CF SL 7 eTap AXS - L",
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
} as const satisfies Record<RentalLocation, readonly string[]>;

export const rentalBikeOptions = [...new Set(Object.values(bikeOptionsByLocation).flat())] as [string, ...string[]];

export const pedalTypes = ["platform", "spdSl", "lookKeo2Max", "other"] as const;
export const computerMountTypes = ["garmin", "wahoo", "other"] as const;
export const maintenanceServiceTypes = ["wax", "cleaning", "parts", "repair", "advice"] as const;

export const pedalTypeLabels = {
  de: { platform: "Plattformpedale", spdSl: "SPD-SL", lookKeo2Max: "Look Keo2 Max", other: "Andere" },
  en: { platform: "Platform pedals", spdSl: "SPD-SL", lookKeo2Max: "Look Keo2 Max", other: "Other" },
} as const;

export const computerMountTypeLabels = {
  de: { garmin: "Garmin", wahoo: "Wahoo", other: "Andere" },
  en: { garmin: "Garmin", wahoo: "Wahoo", other: "Other" },
} as const;
