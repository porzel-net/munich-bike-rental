import { z } from "zod";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getServerSession, isAdmin } from "../../../../lib/auth/session";
import { getDatabase } from "../../../../lib/db/client";
import { authInvitation, authUser } from "../../../../lib/db/schema/auth";
import {
  createInvitationId,
  createInvitationToken,
  hashInvitationToken,
  invitationBaseUrl,
} from "../../../../lib/auth/invitations";
import { rentalLocations } from "../../../../lib/inquiries/catalog";

export const runtime = "nodejs";

const createInvitationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(["admin", "standortuser"]),
    locationKey: z.enum(rentalLocations).nullable(),
  })
  .superRefine((value, context) => {
    if (value.role === "standortuser" && !value.locationKey) {
      context.addIssue({ code: "custom", message: "Standortuser requires a location", path: ["locationKey"] });
    }
    if (value.role === "admin" && value.locationKey) {
      context.addIssue({
        code: "custom",
        message: "Admin must not be restricted to a location",
        path: ["locationKey"],
      });
    }
  });

const updateUserSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["admin", "standortuser"]),
    locationKey: z.enum(rentalLocations).nullable(),
  })
  .superRefine((value, context) => {
    if (value.role === "standortuser" && !value.locationKey) {
      context.addIssue({ code: "custom", message: "Standortuser requires a location", path: ["locationKey"] });
    }
    if (value.role === "admin" && value.locationKey) {
      context.addIssue({
        code: "custom",
        message: "Admin must not be restricted to a location",
        path: ["locationKey"],
      });
    }
  });

const userIdSchema = z.object({ userId: z.string().min(1) });

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
  return origin === new URL(baseURL).origin;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });

  const session = await getServerSession();
  if (!session || !isAdmin(session.user) || !session.user.twoFactorEnabled) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const parsed = createInvitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid user data" }, { status: 400 });

  const token = createInvitationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  getDatabase()
    .insert(authInvitation)
    .values({
      id: createInvitationId(),
      tokenHash: hashInvitationToken(token),
      name: parsed.data.name,
      role: parsed.data.role,
      locationKey: parsed.data.locationKey,
      expiresAt,
      createdBy: session.user.id,
      createdAt: now,
    })
    .run();
  return NextResponse.json(
    { invitation: { link: `${invitationBaseUrl().replace(/\/$/, "")}/admin/signup/${token}` } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function requireAdmin(request: Request) {
  if (!hasTrustedOrigin(request))
    return { response: NextResponse.json({ message: "Invalid origin" }, { status: 403 }) };
  const session = await getServerSession();
  if (!session || !isAdmin(session.user) || !session.user.twoFactorEnabled) {
    return { response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid user data" }, { status: 400 });
  if (parsed.data.userId === access.session.user.id) {
    return NextResponse.json({ message: "You cannot change your own role" }, { status: 400 });
  }

  const updatedAt = new Date();
  const result = getDatabase()
    .update(authUser)
    .set({ role: parsed.data.role, locationKey: parsed.data.locationKey, updatedAt })
    .where(eq(authUser.id, parsed.data.userId))
    .run();
  if (result.changes === 0) return NextResponse.json({ message: "User not found" }, { status: 404 });

  return NextResponse.json({
    user: { id: parsed.data.userId, role: parsed.data.role, locationKey: parsed.data.locationKey },
  });
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const parsed = userIdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid user data" }, { status: 400 });
  if (parsed.data.userId === access.session.user.id) {
    return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
  }

  const result = getDatabase().delete(authUser).where(eq(authUser.id, parsed.data.userId)).run();
  if (result.changes === 0) return NextResponse.json({ message: "User not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
