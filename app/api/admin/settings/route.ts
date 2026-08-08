import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canUseAdminApi, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { readBoundedJson } from "@/lib/security/request-body";

const settingsSchema = z.object({
  whatsappPhone: z.string().trim().max(40, "Die Handynummer darf höchstens 40 Zeichen enthalten."),
});

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApi(session.user)) {
    return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });
  }
  const parsed = settingsSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  getDatabase()
    .update(authUser)
    .set({ whatsappPhone: parsed.data.whatsappPhone || null, updatedAt: new Date() })
    .where(eq(authUser.id, session.user.id))
    .run();

  return NextResponse.json({ whatsappPhone: parsed.data.whatsappPhone }, { headers: { "Cache-Control": "no-store" } });
}
