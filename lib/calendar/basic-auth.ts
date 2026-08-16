import { and, eq } from "drizzle-orm";

import { canAccessAdmin, hasCompletedAdminSetup } from "../auth/authorization";
import { parseBasicAuthorization, verifyCarddavPassword } from "../carddav/auth";
import type { AppDatabase } from "../db/client";
import { authUser, calendarAccounts } from "../db/schema";

export type CalendarAuthenticatedUser = {
  id: string;
  role: string;
  locationKey: string | null;
};

/**
 * Authenticates a calendar subscription against the per-user database account.
 * The returned user is intentionally minimal so callers cannot accidentally
 * expose authentication fields in the calendar feed.
 */
export async function authenticateCalendarRequest(
  request: Request,
  db: AppDatabase,
): Promise<CalendarAuthenticatedUser | null> {
  const credentials = parseBasicAuthorization(request.headers.get("authorization"));
  if (!credentials) return null;

  const account = db
    .select({
      passwordHash: calendarAccounts.passwordHash,
      enabled: calendarAccounts.enabled,
      userId: authUser.id,
      role: authUser.role,
      locationKey: authUser.locationKey,
      banned: authUser.banned,
      banExpires: authUser.banExpires,
      twoFactorEnabled: authUser.twoFactorEnabled,
      mustChangePassword: authUser.mustChangePassword,
    })
    .from(calendarAccounts)
    .innerJoin(authUser, eq(calendarAccounts.userId, authUser.id))
    .where(and(eq(calendarAccounts.username, credentials.username), eq(calendarAccounts.enabled, true)))
    .get();

  if (!account || account.banned || (account.banExpires && account.banExpires.getTime() <= Date.now())) return null;
  if (
    !hasCompletedAdminSetup({
      twoFactorEnabled: account.twoFactorEnabled,
      mustChangePassword: account.mustChangePassword,
    }) ||
    !canAccessAdmin({ role: account.role, locationKey: account.locationKey })
  ) {
    return null;
  }

  const validPassword = await verifyCarddavPassword(credentials.password, account.passwordHash);
  return validPassword ? { id: account.userId, role: account.role, locationKey: account.locationKey } : null;
}
