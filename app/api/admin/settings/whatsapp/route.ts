import { NextResponse } from "next/server";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { readBoundedJson } from "@/lib/security/request-body";
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
  const body = await readBoundedJson(request, 16 * 1024);
  const forceRelink = body !== null && typeof body === "object" && "forceRelink" in body && body.forceRelink === true;
  return NextResponse.json(await whatsappConnection.start({ resetLoggedOutAuth: true, forceRelink }), {
    headers: { "Cache-Control": "no-store" },
  });
}
