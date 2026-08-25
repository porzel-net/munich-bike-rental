import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApi, getServerSession, getVisibleLocationScope } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { dashboardRevenueGoals } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";
import { BUSINESS_TIME_ZONE } from "@/lib/datetime";

const revenueGoalsSchema = z.object({
  annualGoalCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  monthlyGoalCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

function currentYear() {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric" }).format(new Date()));
}

async function getScope() {
  const session = await getServerSession();
  if (!session) return { response: NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 }) };
  if (!canUseAdminApi(session.user)) {
    return { response: NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 }) };
  }

  return { session, scopeKey: getVisibleLocationScope(session.user) ?? "all", year: currentYear() };
}

export async function GET() {
  const scope = await getScope();
  if ("response" in scope) return scope.response;

  const goal = getDatabase()
    .select({
      annualGoalCents: dashboardRevenueGoals.annualGoalCents,
      monthlyGoalCents: dashboardRevenueGoals.monthlyGoalCents,
    })
    .from(dashboardRevenueGoals)
    .where(and(eq(dashboardRevenueGoals.scopeKey, scope.scopeKey), eq(dashboardRevenueGoals.goalYear, scope.year)))
    .get();

  return NextResponse.json(
    {
      annualGoalCents: goal?.annualGoalCents ?? 0,
      monthlyGoalCents: goal?.monthlyGoalCents ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });
  const scope = await getScope();
  if ("response" in scope) return scope.response;

  const parsed = revenueGoalsSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const now = new Date();
  getDatabase()
    .insert(dashboardRevenueGoals)
    .values({
      scopeKey: scope.scopeKey,
      goalYear: scope.year,
      annualGoalCents: parsed.data.annualGoalCents,
      monthlyGoalCents: parsed.data.monthlyGoalCents,
      updatedBy: scope.session.user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dashboardRevenueGoals.scopeKey, dashboardRevenueGoals.goalYear],
      set: {
        annualGoalCents: parsed.data.annualGoalCents,
        monthlyGoalCents: parsed.data.monthlyGoalCents,
        updatedBy: scope.session.user.id,
        updatedAt: now,
      },
    })
    .run();

  return NextResponse.json(
    { annualGoalCents: parsed.data.annualGoalCents, monthlyGoalCents: parsed.data.monthlyGoalCents },
    { headers: { "Cache-Control": "no-store" } },
  );
}
