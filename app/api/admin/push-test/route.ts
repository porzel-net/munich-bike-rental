import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { webPushSubscriptions } from "@/lib/db/schema";
import {
  isWebPushConfigured,
  sendWebPushNotification,
  WebPushEndpointGoneError,
  WebPushEndpointRejectedError,
} from "@/lib/web-push/client";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Nur in der Entwicklungsumgebung verfügbar." }, { status: 404 });
  }

  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApi(session.user)) return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });
  if (!isWebPushConfigured())
    return NextResponse.json({ message: "Browser-Push ist serverseitig nicht konfiguriert." }, { status: 503 });

  const database = getDatabase();
  const subscriptions = database
    .select()
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.userId, session.user.id))
    .all();
  if (subscriptions.length === 0)
    return NextResponse.json({ message: "Für diesen Benutzer ist kein Push-Abonnement registriert." }, { status: 409 });

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await sendWebPushNotification(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
        JSON.stringify({
          title: "Push-Test",
          body: "Der Development-Push ist angekommen.",
          url: "/admin",
          tag: "development-push-test",
          requireInteraction: true,
        }),
      );
      sent += 1;
    } catch (error) {
      if (error instanceof WebPushEndpointGoneError || error instanceof WebPushEndpointRejectedError) {
        database.delete(webPushSubscriptions).where(eq(webPushSubscriptions.id, subscription.id)).run();
        continue;
      }
      console.error("Development push test failed", error);
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Test-Push konnte nicht zugestellt werden." },
        { status: 502 },
      );
    }
  }

  if (sent === 0) return NextResponse.json({ message: "Das Push-Abonnement ist nicht mehr gültig." }, { status: 410 });
  return NextResponse.json({ ok: true, sent });
}
