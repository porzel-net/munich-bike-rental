import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Better Auth's SQLite schema. Kept apart from domain data so auth lifecycle
 * changes do not get mixed with rental-domain migrations.
 */
export const authUser = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("standortuser"),
    locationKey: text("location_key"),
    whatsappPhone: text("whatsapp_phone"),
    banned: integer("banned", { mode: "boolean" }).notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_user_email_unique").on(table.email),
    index("auth_user_role_idx").on(table.role),
    index("auth_user_location_key_idx").on(table.locationKey),
    check("auth_user_role_check", sql`${table.role} in ('admin', 'standortuser')`),
    check(
      "auth_user_location_key_check",
      sql`${table.locationKey} is null or ${table.locationKey} in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz')`,
    ),
  ],
);

/** Append-only security audit trail for privileged admin actions. */
export const adminAuditEvents = sqliteTable(
  "admin_audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("admin_audit_events_actor_created_idx").on(table.actorUserId, table.createdAt)],
);

export const authSession = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_session_token_unique").on(table.token),
    index("auth_session_user_id_idx").on(table.userId),
  ],
);

export const authAccount = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_account_provider_account_unique").on(table.providerId, table.accountId),
    index("auth_account_user_id_idx").on(table.userId),
  ],
);

export const authVerification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const authTwoFactor = sqliteTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("auth_two_factor_user_id_unique").on(table.userId),
    index("auth_two_factor_secret_idx").on(table.secret),
  ],
);

export const authPasskey = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    aaguid: text("aaguid"),
  },
  (table) => [
    uniqueIndex("passkey_credential_id_unique").on(table.credentialID),
    index("passkey_user_id_idx").on(table.userId),
  ],
);

/** Persistent, atomic Better Auth rate-limit counters; never use in-memory limits in production. */
export const authRateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

/** One-time, server-owned account invitations. The URL contains only an opaque token. */
export const authInvitation = sqliteTable(
  "auth_invitation",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    tokenCiphertext: text("token_ciphertext"),
    name: text("name").notNull(),
    role: text("role").notNull(),
    locationKey: text("location_key"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_invitation_token_hash_unique").on(table.tokenHash),
    index("auth_invitation_expires_at_idx").on(table.expiresAt),
    check("auth_invitation_role_check", sql`${table.role} in ('admin', 'standortuser')`),
    check(
      "auth_invitation_location_key_check",
      sql`${table.locationKey} is null or ${table.locationKey} in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz')`,
    ),
  ],
);

export const authSchema = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
  twoFactor: authTwoFactor,
  passkey: authPasskey,
  rateLimit: authRateLimit,
};
