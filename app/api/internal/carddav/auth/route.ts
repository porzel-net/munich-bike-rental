import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { canUseExternalCalendar } from "@/lib/auth/authorization";
import { parseBasicAuthorization, verifyCarddavPassword } from "@/lib/carddav/auth";
import { getDatabase } from "@/lib/db/client";
import { authUser, carddavAccounts } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Nginx auth_request endpoint. It must never be reachable through a normal
 * public location: the Nginx example marks the URI internal and sends the
 * proxy marker below. Radicale receives only the validated username.
 */
export async function GET(request: Request) {
  if (request.headers.get("x-carddav-proxy") !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  const credentials = parseBasicAuthorization(request.headers.get("authorization"));
  if (!credentials) return unauthorized();

  const account = getDatabase()
    .select({
      username: carddavAccounts.username,
      passwordHash: carddavAccounts.passwordHash,
      enabled: carddavAccounts.enabled,
      banned: authUser.banned,
      banExpires: authUser.banExpires,
      twoFactorEnabled: authUser.twoFactorEnabled,
      mustChangePassword: authUser.mustChangePassword,
      role: authUser.role,
      locationKey: authUser.locationKey,
    })
    .from(carddavAccounts)
    .innerJoin(authUser, eq(carddavAccounts.userId, authUser.id))
    .where(eq(carddavAccounts.username, credentials.username))
    .get();
  const eligible =
    account &&
    canUseExternalCalendar({
      role: account.role,
      locationKey: account.locationKey,
      banned: account.banned,
      banExpires: account.banExpires,
      twoFactorEnabled: account.twoFactorEnabled,
      mustChangePassword: account.mustChangePassword,
    });
  if (!eligible || !account.enabled || !(await verifyCarddavPassword(credentials.password, account.passwordHash)))
    return unauthorized();

  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-Remote-User": account.username,
      "Cache-Control": "no-store",
    },
  });
}

function unauthorized() {
  return new NextResponse(null, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Munich Bike Rental CardDAV", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
