import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "../../../../../lib/auth";
import { hashInvitationToken } from "../../../../../lib/auth/invitations";
import { invitationRegistrationSchema, resolveInvitationName } from "../../../../../lib/auth/invitation-validation";
import { getDatabase } from "../../../../../lib/db/client";
import { authInvitation, authUser } from "../../../../../lib/db/schema/auth";
import { rentalLocationLabels, rentalLocations } from "../../../../../lib/inquiries/catalog";

export const runtime = "nodejs";

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(expected).origin;
}

async function findInvitation(token: string) {
  return getDatabase()
    .select()
    .from(authInvitation)
    .where(
      and(
        eq(authInvitation.tokenHash, hashInvitationToken(token)),
        isNull(authInvitation.usedAt),
        gt(authInvitation.expiresAt, new Date()),
      ),
    )
    .get();
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findInvitation(token);
  if (!invitation) return NextResponse.json({ message: "Invitation is invalid or expired" }, { status: 404 });

  const locationKey = rentalLocations.find((value) => value === invitation.locationKey) ?? null;
  return NextResponse.json(
    {
      name: invitation.name || null,
      role: invitation.role,
      locationKey,
      locationLabel: locationKey ? rentalLocationLabels.de[locationKey] : null,
      expiresAt: invitation.expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const { token } = await params;
  const invitation = await findInvitation(token);
  if (!invitation) return NextResponse.json({ message: "Invitation is invalid or expired" }, { status: 404 });

  const parsed = invitationRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid registration data" }, { status: 400 });
  const name = resolveInvitationName(invitation.name, parsed.data.name);
  if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

  const now = new Date();
  const claimed = getDatabase()
    .update(authInvitation)
    .set({ usedAt: now })
    .where(and(eq(authInvitation.id, invitation.id), isNull(authInvitation.usedAt), gt(authInvitation.expiresAt, now)))
    .run();
  if (claimed.changes !== 1) return NextResponse.json({ message: "Invitation is already used" }, { status: 410 });

  try {
    const result = await auth.api.createUser({
      body: {
        name,
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        role: invitation.role as "admin" | "standortuser",
        data: { locationKey: invitation.locationKey },
      },
    });
    if (!result.user) throw new Error("User was not created");
    getDatabase().update(authUser).set({ mustChangePassword: false }).where(eq(authUser.id, result.user.id)).run();
  } catch (error) {
    console.error(
      "Invitation account creation failed",
      error instanceof Error
        ? { name: error.name, message: error.message, cause: error.cause, stack: error.stack }
        : error,
    );
    getDatabase().update(authInvitation).set({ usedAt: null }).where(eq(authInvitation.id, invitation.id)).run();
    return NextResponse.json({ message: "Could not create account" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
