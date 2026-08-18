import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canAccessLocation } from "../../../../lib/auth/authorization";
import { canUseAdminApi, getServerSession } from "../../../../lib/auth/session";
import { getDatabase, runInImmediateTransaction } from "../../../../lib/db/client";
import {
  rentalAssets,
  rentalLocationBikes,
  rentalLocationBikeSizes,
  rentalLocationEquipment,
} from "../../../../lib/db/schema";
import { rentalLocations } from "../../../../lib/inquiries/catalog";
import { readBoundedJson } from "@/lib/security/request-body";
import { formatBikeDisplayName } from "@/lib/inventory/display-name";
import { createBikeKey, getBikeKeyForUpdate } from "@/lib/inventory/bike-key";
import { syncLegacyEquipmentToAccessoryInventory } from "@/lib/inventory/accessory-sync";

export const runtime = "nodejs";

const locationSchema = z.enum(rentalLocations);
const baseSchema = z.object({
  location: locationSchema,
  priceCents: z.number().int().min(0).max(1_000_000_000),
  availableQuantity: z.number().int().min(0).max(10_000).default(1),
  isAvailable: z.boolean().default(true),
});
const bikeSchema = baseSchema.extend({
  type: z.literal("bike"),
  title: z.string().trim().min(1).max(160),
  nickname: z.string().trim().max(120).optional().nullable(),
  size: z.string().trim().min(1).max(32),
  frameNumber: z.string().trim().max(120).optional().nullable(),
  discountTextDe: z.string().trim().max(500).optional(),
  discountTextEn: z.string().trim().max(500).optional(),
});
const equipmentSchema = baseSchema.extend({
  type: z.literal("equipment"),
  category: z.enum(["pedal", "computer-mount", "helmet", "clothing"]),
  labelDe: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
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
  if (!session || !canUseAdminApi(session.user)) return null;
  return session;
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  if (!input.success || !canAccessLocation(session.user, input.data.location)) {
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });
  }

  const db = getDatabase();
  try {
    return runInImmediateTransaction(db, () => {
      if (input.data.type === "bike") {
        const contents = defaultBikeContent(input.data.title);
        const displayOrder =
          (db
            .select({ value: max(rentalLocationBikes.displayOrder) })
            .from(rentalLocationBikes)
            .where(eq(rentalLocationBikes.location, input.data.location))
            .get()?.value ?? 0) + 1;
        const inserted = db
          .insert(rentalLocationBikes)
          .values({
            location: input.data.location,
            bikeKey: createBikeKey(input.data.title, input.data.size),
            title: input.data.title,
            nickname: input.data.nickname?.trim() || null,
            frameNumber: input.data.frameNumber?.trim() || null,
            priceCentsPerDay: input.data.priceCents,
            discountTextDe: input.data.discountTextDe ?? "",
            discountTextEn: input.data.discountTextEn ?? "",
            ...contents,
            displayOrder,
            isAvailable: input.data.isAvailable,
          })
          .returning({ id: rentalLocationBikes.id })
          .get();
        db.insert(rentalLocationBikeSizes)
          .values({ locationBikeId: inserted.id, size: input.data.size, isAvailable: true })
          .run();
        return NextResponse.json(
          { item: { ...input.data, id: inserted.id, bikeKey: createBikeKey(input.data.title, input.data.size) } },
          { status: 201 },
        );
      }

      const key = equipmentKey(input.data.category, input.data.labelDe);
      const displayOrder =
        (db
          .select({ value: max(rentalLocationEquipment.displayOrder) })
          .from(rentalLocationEquipment)
          .where(eq(rentalLocationEquipment.location, input.data.location))
          .get()?.value ?? 0) + 1;
      const inserted = db
        .insert(rentalLocationEquipment)
        .values({
          location: input.data.location,
          equipmentKey: key,
          category: input.data.category,
          labelDe: input.data.labelDe,
          labelEn: input.data.labelEn,
          priceCents: input.data.priceCents,
          availableQuantity: input.data.availableQuantity,
          displayOrder,
          isAvailable: input.data.isAvailable,
        })
        .returning({ id: rentalLocationEquipment.id })
        .get();
      const createdEquipment = db
        .select()
        .from(rentalLocationEquipment)
        .where(eq(rentalLocationEquipment.id, inserted.id))
        .get();
      if (createdEquipment) syncLegacyEquipmentToAccessoryInventory(db, createdEquipment);
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
  if (!input.success || !canAccessLocation(session.user, input.data.location)) {
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });
  }

  const db = getDatabase();
  try {
    if (input.data.type === "bike") {
      const bikeInput = input.data;
      const bike = db
        .select({
          id: rentalLocationBikes.id,
          bikeKey: rentalLocationBikes.bikeKey,
          title: rentalLocationBikes.title,
          nickname: rentalLocationBikes.nickname,
          discountTextDe: rentalLocationBikes.discountTextDe,
          discountTextEn: rentalLocationBikes.discountTextEn,
        })
        .from(rentalLocationBikes)
        .where(and(eq(rentalLocationBikes.id, bikeInput.id), eq(rentalLocationBikes.location, bikeInput.location)))
        .get();
      if (!bike) return NextResponse.json({ message: "Bike nicht gefunden." }, { status: 404 });
      const currentSize = db
        .select({ size: rentalLocationBikeSizes.size })
        .from(rentalLocationBikeSizes)
        .where(eq(rentalLocationBikeSizes.locationBikeId, bikeInput.id))
        .get()?.size;
      const title = bikeInput.title.trim();
      const size = bikeInput.size.trim();
      const nextBikeKey = getBikeKeyForUpdate({
        existingBikeKey: bike.bikeKey,
        existingTitle: bike.title,
        existingSize: currentSize ?? null,
        nextTitle: title,
        nextSize: size,
      });
      const nickname = bikeInput.nickname === undefined ? bike.nickname : bikeInput.nickname?.trim() || null;

      db.transaction((transaction) => {
        transaction
          .update(rentalLocationBikes)
          .set({
            bikeKey: nextBikeKey,
            title,
            nickname,
            frameNumber: bikeInput.frameNumber?.trim() || null,
            priceCentsPerDay: bikeInput.priceCents,
            discountTextDe: bikeInput.discountTextDe ?? bike.discountTextDe,
            discountTextEn: bikeInput.discountTextEn ?? bike.discountTextEn,
            isAvailable: bikeInput.isAvailable,
          })
          .where(eq(rentalLocationBikes.id, bikeInput.id))
          .run();
        transaction
          .delete(rentalLocationBikeSizes)
          .where(eq(rentalLocationBikeSizes.locationBikeId, bikeInput.id))
          .run();
        transaction
          .insert(rentalLocationBikeSizes)
          .values({ locationBikeId: bikeInput.id, size, isAvailable: true })
          .run();
      });
      const linkedAsset = db
        .select({ id: rentalAssets.id })
        .from(rentalAssets)
        .where(eq(rentalAssets.legacyLocationBikeId, bikeInput.id))
        .get();
      if (linkedAsset) {
        db.update(rentalAssets)
          .set({
            nickname: bikeInput.nickname?.trim() || null,
            displayName: formatBikeDisplayName(bikeInput.title, bikeInput.size),
            frameNumber: bikeInput.frameNumber?.trim() || null,
            updatedAt: new Date(),
          })
          .where(eq(rentalAssets.id, linkedAsset.id))
          .run();
      }
      return NextResponse.json({ item: bikeInput });
    }

    const existing = db
      .select({ id: rentalLocationEquipment.id })
      .from(rentalLocationEquipment)
      .where(
        and(eq(rentalLocationEquipment.id, input.data.id), eq(rentalLocationEquipment.location, input.data.location)),
      )
      .get();
    if (!existing) return NextResponse.json({ message: "Ausrüstung nicht gefunden." }, { status: 404 });
    db.update(rentalLocationEquipment)
      .set({
        category: input.data.category,
        labelDe: input.data.labelDe,
        labelEn: input.data.labelEn,
        priceCents: input.data.priceCents,
        availableQuantity: input.data.availableQuantity,
        isAvailable: input.data.isAvailable,
        equipmentKey: equipmentKey(input.data.category, input.data.labelDe),
      })
      .where(eq(rentalLocationEquipment.id, input.data.id))
      .run();
    const updatedEquipment = db
      .select()
      .from(rentalLocationEquipment)
      .where(eq(rentalLocationEquipment.id, input.data.id))
      .get();
    if (updatedEquipment) syncLegacyEquipmentToAccessoryInventory(db, updatedEquipment);
    return NextResponse.json({ item: input.data });
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
  if (!input.success || !canAccessLocation(session.user, input.data.location)) {
    return NextResponse.json({ message: "Ungültige Inventardaten oder fehlende Berechtigung." }, { status: 400 });
  }

  const db = getDatabase();
  if (input.data.type === "bike") {
    const result = runInImmediateTransaction(db, () => {
      const updated = db
        .update(rentalLocationBikes)
        .set({ isAvailable: false })
        .where(and(eq(rentalLocationBikes.id, input.data.id), eq(rentalLocationBikes.location, input.data.location)))
        .run();
      if (updated.changes)
        db.update(rentalLocationBikeSizes)
          .set({ isAvailable: false })
          .where(eq(rentalLocationBikeSizes.locationBikeId, input.data.id))
          .run();
      return updated.changes;
    });
    if (!result) return NextResponse.json({ message: "Bike nicht gefunden." }, { status: 404 });
  } else {
    const result = runInImmediateTransaction(db, () => {
      const updatedEquipment = db
        .update(rentalLocationEquipment)
        .set({ isAvailable: false })
        .where(
          and(eq(rentalLocationEquipment.id, input.data.id), eq(rentalLocationEquipment.location, input.data.location)),
        )
        .returning()
        .get();
      if (updatedEquipment) syncLegacyEquipmentToAccessoryInventory(db, updatedEquipment);
      return updatedEquipment ? 1 : 0;
    });
    if (!result) return NextResponse.json({ message: "Ausrüstung nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
