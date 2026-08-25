import { z } from "zod";

import { rentalLocations } from "../rental-locations";
import { isValidIsoDate, isValidTime } from "./validation";

/** Canonical accessory selection shape shared by public and admin booking commands. */
export const requestedBookingItemSchema = z.object({
  requestedLabel: z.string().trim().min(1).max(120),
  heightCm: z.number().int().min(100).max(250),
  needsPedals: z.boolean().default(false),
  pedalType: z.string().trim().max(32).nullable().default(null),
  needsComputerMount: z.boolean().default(false),
  computerMountType: z.string().trim().max(32).nullable().default(null),
  needsHelmet: z.boolean().default(false),
  needsClothing: z.boolean().default(false),
  needsBikepackingBag: z.boolean().default(false),
  needsGlasses: z.boolean().default(false),
  bottleHolderIncluded: z.boolean().default(true),
  repairKitIncluded: z.boolean().default(true),
  insuranceProtectionSelected: z.boolean().default(true),
});

/** Fields shared by all admin-created booking modes. */
export const adminBookingFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1).max(64),
  location: z.enum(rentalLocations),
  periodFrom: z.string().refine(isValidIsoDate, "Ungültiges Startdatum"),
  periodTo: z.string().refine(isValidIsoDate, "Ungültiges Enddatum"),
  pickupTime: z.string().refine(isValidTime, "Ungültige Abholzeit"),
  dropoffTime: z.string().refine(isValidTime, "Ungültige Rückgabezeit"),
  message: z.string().trim().max(5000).default(""),
  locale: z.enum(["de", "en"]),
  quotedTotalCents: z.number().int().min(0),
  requestedItems: z.array(requestedBookingItemSchema).min(1).max(10),
});

export const adminRoleLocationFieldsSchema = z.object({
  role: z.enum(["admin", "standortuser"]),
  locationKey: z.enum(rentalLocations).nullable(),
});

export const adminRoleLocationSchema = adminRoleLocationFieldsSchema.superRefine((value, context) => {
  if (value.role === "standortuser" && !value.locationKey) {
    context.addIssue({
      code: "custom",
      message: "Für einen Standortbenutzer musst du einen Standort auswählen.",
      path: ["locationKey"],
    });
  }
  if (value.role === "admin" && value.locationKey) {
    context.addIssue({
      code: "custom",
      message: "Ein Administrator darf keinem einzelnen Standort zugeordnet werden.",
      path: ["locationKey"],
    });
  }
});
