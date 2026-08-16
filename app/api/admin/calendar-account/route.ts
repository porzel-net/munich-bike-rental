import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { generateCarddavPassword, hashCarddavPassword } from "@/lib/carddav/auth";
import { calendarUsername } from "@/lib/calendar/account";
import { getDatabase, runInImmediateTransaction } from "@/lib/db/client";
import { calendarAccounts } from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/auth/audit";

export const runtime = "nodejs";

async function getAccess(request: Request, requireOrigin = false) {
  if (requireOrigin && !hasTrustedOrigin(request)) {
    return { response: NextResponse.json({ message: "Invalid origin" }, { status: 403 }) } as const;
  }
  const session = await getServerSession();
  if (!session || !canUseAdminApi(session.user)) {
    return { response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { session } as const;
}

export async function GET(request: Request) {
  const access = await getAccess(request);
  if ("response" in access) return access.response;

  const account = getDatabase()
    .select({
      username: calendarAccounts.username,
      enabled: calendarAccounts.enabled,
      createdAt: calendarAccounts.createdAt,
      updatedAt: calendarAccounts.updatedAt,
    })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, access.session.user.id))
    .get();

  return NextResponse.json({ account: account ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/** Creates or rotates the current user's read-only calendar password. */
export async function POST(request: Request) {
  const access = await getAccess(request, true);
  if ("response" in access) return access.response;

  const db = getDatabase();
  const password = generateCarddavPassword();
  const passwordHash = await hashCarddavPassword(password);
  const username = calendarUsername(access.session.user.id);
  const now = new Date();
  let rotated = false;

  runInImmediateTransaction(db, () => {
    const existing = db
      .select({ id: calendarAccounts.id })
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, access.session.user.id))
      .get();
    rotated = Boolean(existing);
    if (existing) {
      db.update(calendarAccounts)
        .set({ username, passwordHash, enabled: true, updatedAt: now })
        .where(eq(calendarAccounts.id, existing.id))
        .run();
    } else {
      db.insert(calendarAccounts)
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

    recordAdminAuditEvent(db, {
      actorUserId: access.session.user.id,
      action: rotated ? "calendar_password_rotated" : "calendar_account_created",
      targetType: "calendar_account",
      targetId: username,
      metadata: { username },
    });
  });

  return NextResponse.json(
    {
      credentials: { username, password },
      message: "Das Passwort wird nur jetzt angezeigt. Speichere es sicher, bevor du den Dialog schließt.",
    },
    { status: rotated ? 200 : 201, headers: { "Cache-Control": "no-store" } },
  );
}

/** Disables the current user's calendar account without deleting its row. */
export async function DELETE(request: Request) {
  const access = await getAccess(request, true);
  if ("response" in access) return access.response;

  const db = getDatabase();
  const account = db
    .select({ id: calendarAccounts.id, username: calendarAccounts.username })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, access.session.user.id))
    .get();
  if (!account) return new NextResponse(null, { status: 204 });

  db.update(calendarAccounts)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(calendarAccounts.id, account.id))
    .run();
  recordAdminAuditEvent(db, {
    actorUserId: access.session.user.id,
    action: "calendar_account_revoked",
    targetType: "calendar_account",
    targetId: account.username,
    metadata: { username: account.username },
  });
  return new NextResponse(null, { status: 204 });
}
