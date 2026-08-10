import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { whatsappConnection } from "@/lib/whatsapp/connection";

export const dynamic = "force-dynamic";

async function requireAdmin(request: Request, requireOrigin = false) {
  if (requireOrigin && !hasTrustedOrigin(request)) {
    return { response: NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 }) };
  }
  const session = await getServerSession();
  if (!session) return { response: NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 }) };
  if (!canUseAdminApiAsAdmin(session.user)) {
    return { response: NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json(whatsappConnection.getSnapshot(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, true);
  if ("response" in auth) return auth.response;
  return NextResponse.json(await whatsappConnection.start(), { headers: { "Cache-Control": "no-store" } });
}
