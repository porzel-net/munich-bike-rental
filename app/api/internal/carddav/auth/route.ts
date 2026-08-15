import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { parseBasicAuthorization, verifyCarddavPassword } from "@/lib/carddav/auth";
import { getDatabase } from "@/lib/db/client";
import { carddavAccounts } from "@/lib/db/schema";

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
    })
    .from(carddavAccounts)
    .where(eq(carddavAccounts.username, credentials.username))
    .get();
  if (!account || !account.enabled || !(await verifyCarddavPassword(credentials.password, account.passwordHash)))
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
