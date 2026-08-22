import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { dashboardActivityDismissals } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";

const activityDismissalSchema = z.object({
  activityId: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });

  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApi(session.user)) return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });

  const parsed = activityDismissalSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return NextResponse.json({ message: "Ungültige Aktivität." }, { status: 400 });

  getDatabase()
    .insert(dashboardActivityDismissals)
    .values({
      userId: session.user.id,
      activityId: parsed.data.activityId,
      dismissedAt: new Date(),
    })
    .onConflictDoNothing({ target: [dashboardActivityDismissals.userId, dashboardActivityDismissals.activityId] })
    .run();

  return NextResponse.json({ ok: true });
}
