import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { syncContactsToRadicale } from "@/lib/carddav/client";
import { getDatabase } from "@/lib/db/client";
import { carddavAccounts } from "@/lib/db/schema";
import { getVisibleContacts } from "@/lib/contacts/service";
import { recordAdminAuditEvent } from "@/lib/auth/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  const session = await getServerSession();
  if (!session || !canUseAdminApi(session.user)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const db = getDatabase();
  const account = db
    .select({ id: carddavAccounts.id, username: carddavAccounts.username, enabled: carddavAccounts.enabled })
    .from(carddavAccounts)
    .where(and(eq(carddavAccounts.userId, session.user.id), eq(carddavAccounts.enabled, true)))
    .get();
  if (!account) {
    return NextResponse.json({ message: "Richte zuerst den persönlichen CardDAV-Zugang ein." }, { status: 409 });
  }

  const contacts = getVisibleContacts(db, session.user);
  try {
    const result = await syncContactsToRadicale(account.username, contacts);
    const syncedAt = new Date();
    db.update(carddavAccounts)
      .set({ lastSyncedAt: syncedAt, lastSyncError: null, updatedAt: syncedAt })
      .where(eq(carddavAccounts.id, account.id))
      .run();
    recordAdminAuditEvent(db, {
      actorUserId: session.user.id,
      action: "carddav_contacts_synced",
      targetType: "carddav_account",
      targetId: account.username,
      metadata: { contactCount: result.synced },
    });
    return NextResponse.json({ synced: result.synced, syncedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter CardDAV-Fehler.";
    db.update(carddavAccounts)
      .set({ lastSyncError: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(carddavAccounts.id, account.id))
      .run();
    return NextResponse.json(
      { message: "Die Kontakte konnten nicht mit Radicale synchronisiert werden." },
      { status: 502 },
    );
  }
}
