import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { hashCarddavPassword, generateCarddavPassword } from "@/lib/carddav/auth";
import { getCarddavPublicUrl, carddavUsername } from "@/lib/carddav/config";
import { getDatabase } from "@/lib/db/client";
import { carddavAccounts } from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/auth/audit";
import { enqueueCarddavSync } from "@/lib/carddav/queue";

export const runtime = "nodejs";

async function getAccess(request: Request, requireOrigin = false) {
  if (requireOrigin && !hasTrustedOrigin(request)) {
    return {
      response: NextResponse.json(
        { message: "Die Anfrage stammt nicht von der Admin-Seite. Bitte lade die Seite neu und versuche es erneut." },
        { status: 403 },
      ),
    } as const;
  }
  const session = await getServerSession();
  if (!session || !canUseAdminApi(session.user)) {
    return {
      response: NextResponse.json(
        { message: "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung für diese Aktion." },
        { status: 401 },
      ),
    } as const;
  }
  return { session } as const;
}

export async function GET(request: Request) {
  const access = await getAccess(request);
  if ("response" in access) return access.response;

  const db = getDatabase();
  const account = db
    .select({
      username: carddavAccounts.username,
      enabled: carddavAccounts.enabled,
      createdAt: carddavAccounts.createdAt,
      updatedAt: carddavAccounts.updatedAt,
      lastSyncedAt: carddavAccounts.lastSyncedAt,
      lastSyncError: carddavAccounts.lastSyncError,
    })
    .from(carddavAccounts)
    .where(eq(carddavAccounts.userId, access.session.user.id))
    .get();

  return NextResponse.json(
    {
      configured: Boolean(getCarddavPublicUrl()),
      server: getCarddavPublicUrl(),
      account: account
        ? {
            username: account.username,
            enabled: account.enabled,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            lastSyncedAt: account.lastSyncedAt,
            lastSyncError: account.lastSyncError,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Creates or rotates the current user's CardDAV password. */
export async function POST(request: Request) {
  const access = await getAccess(request, true);
  if ("response" in access) return access.response;
  if (!getCarddavPublicUrl()) {
    return NextResponse.json(
      { message: "CARDDAV_PUBLIC_URL fehlt oder ist im Produktionsbetrieb nicht HTTPS." },
      { status: 503 },
    );
  }

  const db = getDatabase();
  const password = generateCarddavPassword();
  const passwordHash = await hashCarddavPassword(password);
  const username = carddavUsername(access.session.user.id);
  const now = new Date();
  const existing = db
    .select({ id: carddavAccounts.id })
    .from(carddavAccounts)
    .where(eq(carddavAccounts.userId, access.session.user.id))
    .get();

  if (existing) {
    db.update(carddavAccounts)
      .set({ username, passwordHash, enabled: true, updatedAt: now, lastSyncError: null })
      .where(eq(carddavAccounts.id, existing.id))
      .run();
  } else {
    db.insert(carddavAccounts)
      .values({
        userId: access.session.user.id,
        username,
        passwordHash,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // A new account may be created after the last booking event was processed.
  // Queue an immediate full sync so the iPhone does not see an empty address
  // book until the next booking change.
  enqueueCarddavSync(db);

  recordAdminAuditEvent(db, {
    actorUserId: access.session.user.id,
    action: existing ? "carddav_password_rotated" : "carddav_account_created",
    targetType: "carddav_account",
    targetId: username,
    metadata: { username },
  });

  return NextResponse.json(
    {
      credentials: {
        server: getCarddavPublicUrl(),
        username,
        password,
      },
      message: "Das Passwort wird nur jetzt angezeigt. Speichere es sicher, bevor du den Dialog schließt.",
    },
    { status: existing ? 200 : 201, headers: { "Cache-Control": "no-store" } },
  );
}

/** Revokes the current user's CardDAV account without deleting its data. */
export async function DELETE(request: Request) {
  const access = await getAccess(request, true);
  if ("response" in access) return access.response;

  const db = getDatabase();
  const account = db
    .select({ id: carddavAccounts.id, username: carddavAccounts.username })
    .from(carddavAccounts)
    .where(eq(carddavAccounts.userId, access.session.user.id))
    .get();
  if (!account) return new NextResponse(null, { status: 204 });

  db.update(carddavAccounts)
    .set({ enabled: false, updatedAt: new Date(), lastSyncError: null })
    .where(and(eq(carddavAccounts.id, account.id), eq(carddavAccounts.userId, access.session.user.id)))
    .run();
  recordAdminAuditEvent(db, {
    actorUserId: access.session.user.id,
    action: "carddav_account_revoked",
    targetType: "carddav_account",
    targetId: account.username,
    metadata: { username: account.username },
  });
  return new NextResponse(null, { status: 204 });
}
