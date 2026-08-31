import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessLocation } from "../../../../lib/auth/authorization";
import { canUseAdminApi, getServerSession } from "../../../../lib/auth/session";
import { hasTrustedOrigin } from "../../../../lib/auth/request";
import { getDatabase, runInImmediateTransaction } from "../../../../lib/db/client";
import { accessoryInventory, bikeModels, bikeVariants, rentalAssets } from "../../../../lib/db/schema";
import { rentalLocations } from "../../../../lib/inquiries/catalog";
import {
  defaultUncountedEquipmentCategories,
  equipmentCategories,
} from "../../../../lib/inventory/equipment-categories";
import { formatBikeDisplayName } from "../../../../lib/inventory/display-name";
import { createBikeKey } from "../../../../lib/inventory/bike-key";
import { readBoundedJson } from "../../../../lib/security/request-body";

export const runtime = "nodejs";

const locationSchema = z.enum(rentalLocations);
const commonSchema = z.object({
  location: locationSchema,
  availableQuantity: z.number().int().min(0).max(10_000).default(1),
});
const bikeSchema = commonSchema.extend({
  type: z.literal("bike"),
  title: z.string().trim().min(1).max(160),
  nickname: z.string().trim().max(120).optional().nullable(),
  size: z.string().trim().min(1).max(32),
  frameNumber: z.string().trim().max(120).optional().nullable(),
  weekdayPriceCents: z.number().int().min(0).max(1_000_000_000),
  weekendPriceCents: z.number().int().min(0).max(1_000_000_000),
  isVisibleOnLanding: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  /** Kept as a backwards-compatible alias for older admin clients. */
  isAvailable: z.boolean().optional(),
});
const equipmentSchema = commonSchema.extend({
  type: z.literal("equipment"),
  isAvailable: z.boolean().default(true),
  priceCents: z.number().int().min(0).max(1_000_000_000),
  category: z.enum(equipmentCategories),
  labelDe: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  quantityRelevant: z.boolean().optional(),
});
const createSchema = z.discriminatedUnion("type", [bikeSchema, equipmentSchema]);
const updateSchema = z.discriminatedUnion("type", [
  bikeSchema.extend({ id: z.number().int().positive() }),
  equipmentSchema.extend({ id: z.number().int().positive() }),
]);
const deleteSchema = z.object({
  type: z.enum(["bike", "equipment"]),
  id: z.number().int().positive(),
  location: locationSchema,
});

async function getAuthorizedSession(request: Request) {
  if (!hasTrustedOrigin(request)) return null;
  const session = await getServerSession();
  return session && canUseAdminApi(session.user) ? session : null;
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function modelKey(title: string) {
  return slug(title);
}

function equipmentKey(category: z.infer<typeof equipmentSchema>["category"], label: string) {
  if (category === "helmet") return "helmet";
  if (category === "clothing") return "clothing";
  return `${category === "computer-mount" ? "mount" : "pedal"}-${slug(label)}`;
}

function defaultBikeContent(title: string) {
  return {
    descriptionDe: title,
    descriptionEn: title,
    image: "/assets/img/svg/placeholder.svg",
    galleryJson: "[]",
    factsJson: "[]",
    equipmentJson: JSON.stringify({ de: [], en: [] }),
  };
}

function getOrCreateModel(db: ReturnType<typeof getDatabase>, location: string, title: string, createdAt: Date) {
  const key = modelKey(title);
  const existing = db
    .select({ id: bikeModels.id })
    .from(bikeModels)
    .where(and(eq(bikeModels.location, location), eq(bikeModels.modelKey, key)))
    .get();
  if (existing) return existing.id;
  return db
    .insert(bikeModels)
    .values({ location, modelKey: key, title, ...defaultBikeContent(title), createdAt })
    .returning({ id: bikeModels.id })
    .get()!.id;
}

function getOrCreateVariant(db: ReturnType<typeof getDatabase>, modelId: number, size: string, createdAt: Date) {
  const existing = db
    .select({ id: bikeVariants.id })
    .from(bikeVariants)
    .where(and(eq(bikeVariants.modelId, modelId), eq(bikeVariants.size, size)))
    .get();
  if (existing) return existing.id;
  return db.insert(bikeVariants).values({ modelId, size, createdAt }).returning({ id: bikeVariants.id }).get()!.id;
}

function bikeResponse(input: z.infer<typeof bikeSchema>, id: number) {
  const flags = bikeFlags(input);
  return {
    ...input,
    ...flags,
    id,
    bikeKey: createBikeKey(input.title, input.size),
  };
}

function bikeFlags(input: z.infer<typeof bikeSchema>) {
  const legacyAvailability = input.isAvailable ?? true;
  return {
    isVisibleOnLanding: input.isVisibleOnLanding ?? legacyAvailability,
    isBookable: input.isBookable ?? legacyAvailability,
  };
}

function duplicateResponse() {
  return NextResponse.json(
    { message: "Dieser Eintrag existiert an diesem Standort bereits." },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await getAuthorizedSession(request);
  if (!session)
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  const input = createSchema.safeParse(await readBoundedJson(request));
  if (!input.success || !canAccessLocation(session.user, input.data.location))
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });

  const db = getDatabase();
  try {
    return runInImmediateTransaction(db, () => {
      if (input.data.type === "bike") {
        const stamp = new Date();
        const modelId = getOrCreateModel(db, input.data.location, input.data.title, stamp);
        const variantId = getOrCreateVariant(db, modelId, input.data.size, stamp);
        const flags = bikeFlags(input.data);
        const inserted = db
          .insert(rentalAssets)
          .values({
            variantId,
            location: input.data.location,
            assetCode: `${input.data.location}-${slug(input.data.title)}-${slug(input.data.size)}-${randomUUID()}`,
            nickname: input.data.nickname?.trim() || null,
            frameNumber: input.data.frameNumber?.trim() || null,
            displayName: formatBikeDisplayName(input.data.title, input.data.size),
            weekdayPriceCents: input.data.weekdayPriceCents,
            weekendPriceCents: input.data.weekendPriceCents,
            ...flags,
            state: flags.isBookable ? "active" : "maintenance",
            createdAt: stamp,
            updatedAt: stamp,
          })
          .returning({ id: rentalAssets.id })
          .get()!;
        return NextResponse.json({ item: bikeResponse(input.data, inserted.id) }, { status: 201 });
      }

      const key = equipmentKey(input.data.category, input.data.labelDe);
      const quantityRelevant =
        input.data.quantityRelevant ?? !defaultUncountedEquipmentCategories.has(input.data.category);
      const inserted = db
        .insert(accessoryInventory)
        .values({
          location: input.data.location,
          accessoryKey: key,
          category: input.data.category,
          labelDe: input.data.labelDe,
          labelEn: input.data.labelEn,
          priceCents: input.data.priceCents,
          availableQuantity: input.data.availableQuantity,
          quantityRelevant,
          state:
            input.data.isAvailable && (!quantityRelevant || input.data.availableQuantity > 0)
              ? "active"
              : "maintenance",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: accessoryInventory.id })
        .get()!;
      return NextResponse.json({ item: { ...input.data, id: inserted.id, equipmentKey: key } }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return duplicateResponse();
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthorizedSession(request);
  if (!session)
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  const input = updateSchema.safeParse(await readBoundedJson(request));
  if (!input.success || !canAccessLocation(session.user, input.data.location))
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });

  const db = getDatabase();
  try {
    return runInImmediateTransaction(db, () => {
      if (input.data.type === "bike") {
        const current = db
          .select({ asset: rentalAssets, model: bikeModels, variant: bikeVariants })
          .from(rentalAssets)
          .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
          .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
          .where(and(eq(rentalAssets.id, input.data.id), eq(rentalAssets.location, input.data.location)))
          .get();
        if (!current) return NextResponse.json({ message: "Bike nicht gefunden." }, { status: 404 });
        const stamp = new Date();
        const modelId = getOrCreateModel(db, input.data.location, input.data.title, stamp);
        const variantId = getOrCreateVariant(db, modelId, input.data.size, stamp);
        const flags = bikeFlags(input.data);
        db.update(rentalAssets)
          .set({
            variantId,
            nickname: input.data.nickname?.trim() || null,
            frameNumber: input.data.frameNumber?.trim() || null,
            displayName: formatBikeDisplayName(input.data.title, input.data.size),
            weekdayPriceCents: input.data.weekdayPriceCents,
            weekendPriceCents: input.data.weekendPriceCents,
            ...flags,
            state: flags.isBookable ? "active" : "maintenance",
            updatedAt: stamp,
          })
          .where(eq(rentalAssets.id, input.data.id))
          .run();
        return NextResponse.json({ item: bikeResponse(input.data, input.data.id) });
      }

      const existing = db
        .select({ quantityRelevant: accessoryInventory.quantityRelevant })
        .from(accessoryInventory)
        .where(and(eq(accessoryInventory.id, input.data.id), eq(accessoryInventory.location, input.data.location)))
        .get();
      if (!existing) return NextResponse.json({ message: "Ausrüstung nicht gefunden." }, { status: 404 });
      const quantityRelevant = input.data.quantityRelevant ?? existing.quantityRelevant;
      db.update(accessoryInventory)
        .set({
          category: input.data.category,
          labelDe: input.data.labelDe,
          labelEn: input.data.labelEn,
          priceCents: input.data.priceCents,
          availableQuantity: input.data.availableQuantity,
          quantityRelevant,
          state:
            input.data.isAvailable && (!quantityRelevant || input.data.availableQuantity > 0)
              ? "active"
              : "maintenance",
          accessoryKey: equipmentKey(input.data.category, input.data.labelDe),
          updatedAt: new Date(),
        })
        .where(eq(accessoryInventory.id, input.data.id))
        .run();
      return NextResponse.json({ item: { ...input.data, quantityRelevant } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return duplicateResponse();
    throw error;
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthorizedSession(request);
  if (!session)
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig. Bitte melde dich erneut an." },
      { status: 401 },
    );
  const input = deleteSchema.safeParse(await readBoundedJson(request));
  if (!input.success || !canAccessLocation(session.user, input.data.location))
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });

  const db = getDatabase();
  if (input.data.type === "bike") {
    const result = runInImmediateTransaction(
      db,
      () =>
        db
          .update(rentalAssets)
          .set({ state: "retired", isVisibleOnLanding: false, isBookable: false, updatedAt: new Date() })
          .where(and(eq(rentalAssets.id, input.data.id), eq(rentalAssets.location, input.data.location)))
          .run().changes,
    );
    if (!result) return NextResponse.json({ message: "Bike nicht gefunden." }, { status: 404 });
  } else {
    const result = runInImmediateTransaction(
      db,
      () =>
        db
          .update(accessoryInventory)
          .set({ state: "retired", updatedAt: new Date() })
          .where(and(eq(accessoryInventory.id, input.data.id), eq(accessoryInventory.location, input.data.location)))
          .run().changes,
    );
    if (!result) return NextResponse.json({ message: "Ausrüstung nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
