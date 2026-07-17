import { z } from "zod";

import { computerMountTypes, maintenanceServiceTypes, pedalTypes, rentalBikeOptions, rentalLocations } from "./catalog";

const MAX_MESSAGE_LENGTH = 4_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const line = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .refine((value) => !/[\r\n]/.test(value));
const requiredLine = (maxLength: number) => line(maxLength).min(1);
const optionalLine = (maxLength: number) => line(maxLength).optional().default("");
const booleanInput = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

function isCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const date = requiredLine(10).refine(isCalendarDate, "Invalid calendar date");
const time = requiredLine(5).regex(TIME_PATTERN, "Invalid time");
const locale = z.enum(["de", "en"]).default("de");
const honeypot = optionalLine(200);

export const contactInquirySchema = z
  .object({
    name: requiredLine(120),
    contact: requiredLine(254).email(),
    phone: requiredLine(64),
    height: requiredLine(3)
      .regex(/^\d{2,3}$/)
      .refine((value) => Number(value) >= 100 && Number(value) <= 250, "Height out of range"),
    location: z.enum(rentalLocations),
    bikeSize: z.enum(rentalBikeOptions),
    periodFrom: date,
    periodTo: date,
    pickupTime: time,
    dropoffTime: time,
    needsPedals: booleanInput.default(false),
    pedalType: optionalLine(32),
    needsComputerMount: booleanInput.default(false),
    computerMountType: optionalLine(32),
    needsHelmet: booleanInput.default(false),
    needsClothing: booleanInput.default(false),
    message: requiredLine(MAX_MESSAGE_LENGTH),
    bikeTitle: optionalLine(120),
    locale,
    affiliateKey: optionalLine(120),
    website: honeypot,
  })
  .superRefine((value, context) => {
    if (value.periodFrom > value.periodTo) {
      context.addIssue({ code: "custom", path: ["periodTo"], message: "End date is before start date" });
    }

    if (value.needsPedals && !pedalTypes.includes(value.pedalType as (typeof pedalTypes)[number])) {
      context.addIssue({ code: "custom", path: ["pedalType"], message: "Invalid pedal type" });
    }

    if (
      value.needsComputerMount &&
      !computerMountTypes.includes(value.computerMountType as (typeof computerMountTypes)[number])
    ) {
      context.addIssue({ code: "custom", path: ["computerMountType"], message: "Invalid computer mount type" });
    }
  });

export const maintenanceInquirySchema = z.object({
  name: requiredLine(120),
  contact: requiredLine(254).email(),
  bikeModel: requiredLine(160),
  serviceType: z.enum(maintenanceServiceTypes),
  pickup: booleanInput.default(false),
  message: requiredLine(MAX_MESSAGE_LENGTH),
  locale,
  website: honeypot,
});

export type ContactInquiry = z.infer<typeof contactInquirySchema>;
export type MaintenanceInquiry = z.infer<typeof maintenanceInquirySchema>;

export function isValidEmail(value: string) {
  return z.string().trim().email().safeParse(value).success;
}
