import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "../../../../lib/auth/session";
import { createInvitationToken, hashInvitationToken, invitationBaseUrl } from "../../../../lib/auth/invitations";
import { getDatabase } from "../../../../lib/db/client";
import { authInvitation } from "../../../../lib/db/schema/auth";
import { rentalLocations } from "../../../../lib/inquiries/catalog";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const invitationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(["admin", "standortuser"]),
    locationKey: z.enum(rentalLocations).nullable(),
  })
  .superRefine((value, context) => {
    if (value.role === "standortuser" && !value.locationKey) {
      context.addIssue({
        code: "custom",
        path: ["locationKey"],
        message: "Für einen Standortbenutzer musst du einen Standort auswählen.",
      });
    }
    if (value.role === "admin" && value.locationKey) {
      context.addIssue({
        code: "custom",
        path: ["locationKey"],
        message: "Ein Administrator darf keinem einzelnen Standort zugeordnet werden.",
      });
    }
  });

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json(
      { message: "Die Anfrage stammt nicht von der Admin-Seite. Bitte lade die Seite neu und versuche es erneut." },
      { status: 403 },
    );

  const session = await getServerSession();
  if (!session || !canUseAdminApiAsAdmin(session.user)) {
    return NextResponse.json(
      { message: "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung für diese Aktion." },
      { status: 401 },
    );
  }

  const parsed = invitationSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success)
    return NextResponse.json(
      { message: "Die Einladung ist unvollständig oder ungültig. Prüfe Name, Rolle und Standort." },
      { status: 400 },
    );

  const token = createInvitationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  getDatabase()
    .insert(authInvitation)
    .values({
      id: randomUUID(),
      tokenHash: hashInvitationToken(token),
      name: parsed.data.name,
      role: parsed.data.role,
      locationKey: parsed.data.locationKey,
      expiresAt,
      createdBy: session.user.id,
      createdAt: now,
    })
    .run();

  const link = `${invitationBaseUrl().replace(/\/$/, "")}/admin/signup/${token}`;
  return NextResponse.json(
    {
      invitation: {
        link,
        name: parsed.data.name,
        role: parsed.data.role,
        locationKey: parsed.data.locationKey,
        expiresAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
