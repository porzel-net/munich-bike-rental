import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { salaryTaxRates } from "@/lib/db/schema";
import { readBoundedJson } from "@/lib/security/request-body";

const taxRatesSchema = z
  .object({
    years: z
      .array(
        z.object({
          year: z.number().int().min(2000).max(2200),
          incomeTaxBasisPoints: z.number().int().min(0).max(10000),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine(({ years }, context) => {
    const seenYears = new Set<number>();
    years.forEach(({ year }, index) => {
      if (seenYears.has(year)) {
        context.addIssue({
          code: "custom",
          message: "Jedes Jahr darf nur einmal vorkommen.",
          path: ["years", index, "year"],
        });
      }
      seenYears.add(year);
    });
  });

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "Ungültiger Ursprung." }, { status: 403 });
  const session = await getServerSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  if (!canUseAdminApiAsAdmin(session.user))
    return NextResponse.json({ message: "Keine Berechtigung." }, { status: 403 });

  const parsed = taxRatesSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ungültige Steuersätze." }, { status: 400 });
  }

  const db = getDatabase();
  const now = new Date();
  db.transaction((tx) => {
    for (const rates of parsed.data.years) {
      tx.insert(salaryTaxRates)
        .values({ ...rates, tradeTaxBasisPoints: 0, vatBasisPoints: 0, updatedBy: session.user.id, updatedAt: now })
        .onConflictDoUpdate({
          target: salaryTaxRates.year,
          set: {
            tradeTaxBasisPoints: 0,
            vatBasisPoints: 0,
            incomeTaxBasisPoints: rates.incomeTaxBasisPoints,
            updatedBy: session.user.id,
            updatedAt: now,
          },
        })
        .run();
    }
  });

  return NextResponse.json({ years: parsed.data.years }, { headers: { "Cache-Control": "no-store" } });
}
