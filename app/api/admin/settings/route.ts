import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";

const settingsSchema = z.object({
  whatsappPhone: z.string().trim().max(40, "Die Handynummer darf höchstens 40 Zeichen enthalten."),
});

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  getDatabase()
    .update(authUser)
    .set({ whatsappPhone: parsed.data.whatsappPhone || null, updatedAt: new Date() })
    .where(eq(authUser.id, session.user.id))
    .run();

  return NextResponse.json({ whatsappPhone: parsed.data.whatsappPhone });
}
