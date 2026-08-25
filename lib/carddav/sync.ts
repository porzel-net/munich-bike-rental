import { eq } from "drizzle-orm";

import { canUseExternalCalendar } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { authUser, carddavAccounts } from "@/lib/db/schema";
import { getVisibleContacts } from "@/lib/contacts/service";

import { syncContactsToRadicale } from "./client";

let syncInProgress = false;

export async function syncAllEnabledCarddavAccounts() {
  if (syncInProgress) return { busy: true, syncedAccounts: 0, failedAccounts: 0, disabledAccounts: 0 };

  syncInProgress = true;
  try {
    const db = getDatabase();
    const accounts = db
      .select({
        accountId: carddavAccounts.id,
        username: carddavAccounts.username,
        userId: carddavAccounts.userId,
        role: authUser.role,
        locationKey: authUser.locationKey,
        banned: authUser.banned,
        banExpires: authUser.banExpires,
        twoFactorEnabled: authUser.twoFactorEnabled,
        mustChangePassword: authUser.mustChangePassword,
      })
      .from(carddavAccounts)
      .innerJoin(authUser, eq(carddavAccounts.userId, authUser.id))
      .where(eq(carddavAccounts.enabled, true))
      .all();

    let syncedAccounts = 0;
    let failedAccounts = 0;
    let disabledAccounts = 0;

    for (const account of accounts) {
      if (
        !canUseExternalCalendar({
          role: account.role,
          locationKey: account.locationKey,
          banned: account.banned,
          banExpires: account.banExpires,
          twoFactorEnabled: account.twoFactorEnabled,
          mustChangePassword: account.mustChangePassword,
        })
      ) {
        db.update(carddavAccounts)
          .set({
            enabled: false,
            updatedAt: new Date(),
            lastSyncError: "CardDAV wegen geänderter Berechtigungen deaktiviert.",
          })
          .where(eq(carddavAccounts.id, account.accountId))
          .run();
        disabledAccounts += 1;
        continue;
      }

      try {
        const contacts = getVisibleContacts(db, {
          id: account.userId,
          role: account.role,
          locationKey: account.locationKey,
        });
        await syncContactsToRadicale(account.username, contacts);
        const syncedAt = new Date();
        db.update(carddavAccounts)
          .set({ lastSyncedAt: syncedAt, lastSyncError: null, updatedAt: syncedAt })
          .where(eq(carddavAccounts.id, account.accountId))
          .run();
        syncedAccounts += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unbekannter CardDAV-Fehler.";
        db.update(carddavAccounts)
          .set({ lastSyncError: message.slice(0, 500), updatedAt: new Date() })
          .where(eq(carddavAccounts.id, account.accountId))
          .run();
        failedAccounts += 1;
      }
    }

    return { busy: false, syncedAccounts, failedAccounts, disabledAccounts };
  } finally {
    syncInProgress = false;
  }
}
