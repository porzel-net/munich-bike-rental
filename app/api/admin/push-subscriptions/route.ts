import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { webPushSubscriptions } from "@/lib/db/schema";
import { consumeBoundedRateLimit } from "@/lib/security/rate-limit";
import { getWebPushPublicKey } from "@/lib/web-push/client";
import { isAllowedWebPushEndpoint } from "@/lib/web-push/endpoint";
import { upsertWebPushSubscription } from "@/lib/web-push/subscriptions";
import { readBoundedJson } from "@/lib/security/request-body";

const subscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2_048).refine(isAllowedWebPushEndpoint),
  keys: z.object({
    p256dh: z.string().trim().min(40).max(200),
    auth: z.string().trim().min(16).max(100),
  }),
});

const endpointSchema = z.object({ endpoint: z.string().trim().url().max(2_048) });

async function getAuthorizedSession(request: Request, checkOrigin = true) {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 }) };
  if (!canUseAdminApi(session.user))
    return { error: NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 }) };
  if (checkOrigin && !hasTrustedOrigin(request))
    return { error: NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 }) };
  return { session };
}

export async function GET(request: Request) {
  const authorized = await getAuthorizedSession(request, false);
  if (authorized.error) return authorized.error;
  const publicKey = getWebPushPublicKey();
  if (!publicKey)
    return NextResponse.json({ message: "Browser-Push ist serverseitig nicht konfiguriert." }, { status: 503 });
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const authorized = await getAuthorizedSession(request);
  if (authorized.error) return authorized.error;
  if (!consumeBoundedRateLimit(`web-push-subscription:${authorized.session.user.id}`, 20, 10 * 60_000)) {
    return NextResponse.json(
      { message: "Zu viele Push-Abonnement-Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "600" } },
    );
  }
  const parsed = subscriptionSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return NextResponse.json({ message: "Ungültiges Browser-Push-Abonnement." }, { status: 400 });

  const result = upsertWebPushSubscription(
    {
      userId: authorized.session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    getDatabase(),
  );
  if (result === "conflict")
    return NextResponse.json({ message: "Dieses Push-Abonnement ist bereits registriert." }, { status: 409 });
  if (result === "limit")
    return NextResponse.json({ message: "Maximal zehn Push-Geräte pro Benutzer sind erlaubt." }, { status: 409 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authorized = await getAuthorizedSession(request);
  if (authorized.error) return authorized.error;
  const parsed = endpointSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return NextResponse.json({ message: "Ungültiger Browser-Push-Endpunkt." }, { status: 400 });

  getDatabase()
    .delete(webPushSubscriptions)
    .where(
      and(
        eq(webPushSubscriptions.endpoint, parsed.data.endpoint),
        eq(webPushSubscriptions.userId, authorized.session.user.id),
      ),
    )
    .run();
  return NextResponse.json({ ok: true });
}
