import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { authInvitation, authUser } from "../db/schema/auth";

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createInvitationId() {
  return randomUUID();
}

export function invitationBaseUrl() {
  return process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
}

function invitationEncryptionKey() {
  return createHash("sha256")
    .update(process.env.BETTER_AUTH_SECRET?.trim() || "local-development-bootstrap-invitation-key")
    .digest();
}

function encryptInvitationToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", invitationEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptInvitationToken(value: string) {
  try {
    const [ivValue, tagValue, ciphertextValue] = value.split(".");
    if (!ivValue || !tagValue || !ciphertextValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", invitationEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

function publishBootstrapInvitation(link: string) {
  // The build database is disposable. Never emit a usable invitation into
  // build logs.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  console.info(`BOOTSTRAP_ADMIN_INVITATION=${link}`);
  console.info("Der Link ist 24 Stunden gültig und wird nach einmaliger Verwendung ungültig.");
}

/**
 * Creates a one-time first-admin invitation without creating a user. The link
 * is handed off through the application log for the deployment operator.
 */
export function ensureBootstrapInvitation() {
  const db = getDatabase();
  const [{ userCount }] = db.select({ userCount: count() }).from(authUser).all();
  if (userCount !== 0) {
    return null;
  }

  const now = new Date();
  db.update(authInvitation)
    .set({ usedAt: now })
    .where(
      and(
        eq(authInvitation.name, "Erstadministrator"),
        eq(authInvitation.role, "admin"),
        isNull(authInvitation.createdBy),
        isNull(authInvitation.usedAt),
      ),
    )
    .run();
  const existing = db
    .select({ id: authInvitation.id, tokenCiphertext: authInvitation.tokenCiphertext })
    .from(authInvitation)
    .where(
      and(
        eq(authInvitation.name, ""),
        eq(authInvitation.role, "admin"),
        isNull(authInvitation.createdBy),
        isNull(authInvitation.usedAt),
      ),
    )
    .get();
  const existingToken = existing?.tokenCiphertext ? decryptInvitationToken(existing.tokenCiphertext) : null;
  if (existingToken) {
    const link = `${invitationBaseUrl().replace(/\/$/, "")}/admin/signup/${existingToken}`;
    publishBootstrapInvitation(link);
    return link;
  }
  if (existing) db.update(authInvitation).set({ usedAt: now }).where(eq(authInvitation.id, existing.id)).run();

  const token = createInvitationToken();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  db.insert(authInvitation)
    .values({
      id: createInvitationId(),
      tokenHash: hashInvitationToken(token),
      tokenCiphertext: encryptInvitationToken(token),
      name: "",
      role: "admin",
      locationKey: null,
      expiresAt,
      createdBy: null,
      createdAt: now,
    })
    .run();

  const link = `${invitationBaseUrl().replace(/\/$/, "")}/admin/signup/${token}`;
  publishBootstrapInvitation(link);
  return link;
}
