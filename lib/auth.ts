import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin, createAccessControl, twoFactor } from "better-auth/plugins";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";

import { getDatabase } from "./db/client";
import { ensureBootstrapInvitation } from "./auth/invitations";
import { authSchema } from "./db/schema/auth";

const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET?.trim();
const accessControl = createAccessControl(defaultStatements);
const adminRole = accessControl.newRole({
  user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "set-email", "get", "update"],
  session: ["list", "revoke", "delete"],
});
const locationUserRole = accessControl.newRole({
  user: [],
  session: [],
});

export const auth = betterAuth({
  appName: "Munich Bike Rental Admin",
  baseURL,
  secret,
  database: drizzleAdapter(getDatabase(), {
    provider: "sqlite",
    schema: authSchema,
  }),
  databaseHooks: {
    account: {
      update: {
        after: async (account, context) => {
          if (context?.path !== "/change-password" || account.providerId !== "credential" || !account.password) return;

          await getDatabase()
            .update(authSchema.user)
            .set({ mustChangePassword: false })
            .where(eq(authSchema.user.id, account.userId));
        },
      },
    },
  },
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 14,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      locationKey: {
        type: "string",
        required: false,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        input: false,
        defaultValue: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 15,
    cookieCache: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 20,
    customRules: {
      "/sign-up/email": { window: 60 * 60, max: 3 },
      "/sign-in/email": { window: 15 * 60, max: 5 },
      "/two-factor/verify-totp": { window: 15 * 60, max: 5 },
      "/two-factor/enable": { window: 15 * 60, max: 3 },
      "/two-factor/get-totp-uri": { window: 15 * 60, max: 3 },
      "/forget-password": { window: 60 * 60, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "mbr-admin",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    ipAddress: {
      // Nginx must be configured to overwrite this header; do not trust client X-Forwarded-For chains.
      ipAddressHeaders: ["x-real-ip"],
      ipv6Subnet: 64,
    },
  },
  plugins: [
    admin({
      ac: accessControl,
      roles: {
        admin: adminRole,
        standortuser: locationUserRole,
      },
      defaultRole: "standortuser",
    }),
    twoFactor({
      issuer: "Munich Bike Rental",
      twoFactorCookieMaxAge: 5 * 60,
      // A trusted-device cookie weakens the mandatory second factor. The route handler rejects it.
      trustDeviceMaxAge: 1,
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 30 * 60,
      },
    }),
    passkey({
      rpID: new URL(baseURL).hostname,
      rpName: "Your Bike Rental",
      origin: baseURL,
    }),
  ],
});

// No account is provisioned automatically. When the database is empty, print
// a one-time first-admin invitation for the deployment operator.
ensureBootstrapInvitation();
