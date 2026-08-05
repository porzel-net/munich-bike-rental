import { NextResponse } from "next/server";

import { getServerSession, isAdmin } from "@/lib/auth/session";
import { whatsappConnection } from "@/lib/whatsapp/connection";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session) return { response: NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 }) };
  if (!isAdmin(session.user)) return { response: NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  return NextResponse.json(whatsappConnection.getSnapshot());
}

export async function POST() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await whatsappConnection.start());
}
