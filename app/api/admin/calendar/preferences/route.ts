import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { calendarFilterPreferences, bookingStatuses } from "@/lib/db/schema";
import { rentalLocations } from "@/lib/inquiries/catalog";
import { readBoundedJson } from "@/lib/security/request-body";

const preferenceSchema = z.object({
  location: z.string().trim().max(40).default("all"),
  status: z.string().trim().max(500).default(""),
});

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });

  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApi(session.user)) return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });

  const parsed = preferenceSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return NextResponse.json({ message: "Ungültige Filter." }, { status: 400 });

  const assignedLocation = getAssignedLocation(session.user);
  const location = isAdmin(session.user)
    ? parsed.data.location === "all" ||
      rentalLocations.includes(parsed.data.location as (typeof rentalLocations)[number])
      ? parsed.data.location
      : null
    : assignedLocation;
  if (!location) return NextResponse.json({ message: "Ungültiger Standort." }, { status: 400 });

  const statuses = [
    ...new Set(parsed.data.status.split(",").filter((value) => bookingStatuses.includes(value as never))),
  ];
  if (statuses.length !== parsed.data.status.split(",").filter(Boolean).length) {
    return NextResponse.json({ message: "Ungültiger Buchungsstatus." }, { status: 400 });
  }

  const db = getDatabase();
  db.insert(calendarFilterPreferences)
    .values({ userId: session.user.id, location, status: statuses.join(","), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: calendarFilterPreferences.userId,
      set: { location, status: statuses.join(","), updatedAt: new Date() },
    })
    .run();

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
