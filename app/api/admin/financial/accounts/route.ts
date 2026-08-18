import { NextResponse } from "next/server";
import { z } from "zod";

import { BookingCommandError } from "@/lib/bookings/errors";
import { hasTrustedOrigin } from "@/lib/auth/request";
import { canUseAdminApiAsAdmin, getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialAccountTypes } from "@/lib/db/schema";
import { createFinancialAccount } from "@/lib/financial/accounts";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Die Kontokennung muss mindestens 2 Zeichen enthalten.")
    .max(40, "Die Kontokennung darf höchstens 40 Zeichen enthalten.")
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche sind erlaubt.")
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Bitte gib einen Kontonamen ein.").max(100),
  type: z.enum(financialAccountTypes),
  currency: z
    .string()
    .trim()
    .length(3, "Die Währung muss aus drei Zeichen bestehen.")
    .regex(/^[a-zA-Z]+$/, "Die Währung darf nur Buchstaben enthalten.")
    .transform((value) => value.toUpperCase()),
  iban: z.string().trim().max(34, "Die IBAN darf höchstens 34 Zeichen enthalten.").optional().default(""),
  provider: z.string().trim().max(80, "Der Anbieter darf höchstens 80 Zeichen enthalten.").optional().default(""),
  notes: z.string().trim().max(500, "Die Notiz darf höchstens 500 Zeichen enthalten.").optional().default(""),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!hasTrustedOrigin(request) || !session || !canUseAdminApiAsAdmin(session.user))
    return NextResponse.json(
      {
        message:
          "Deine Admin-Sitzung ist nicht mehr gültig oder du hast keine Berechtigung, Finanzkonten zu verwalten.",
      },
      { status: 401 },
    );
  const input = createSchema.safeParse(await readBoundedJson(request));
  if (!input.success)
    return NextResponse.json(
      {
        message:
          input.error.issues[0]?.message ??
          "Die Kontodaten sind unvollständig. Prüfe Kontokennung, Kontoname, Währung und Kontotyp.",
      },
      { status: 400 },
    );
  try {
    const account = createFinancialAccount(getDatabase(), input.data, session.user.id);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof BookingCommandError
            ? error.message
            : "Das Finanzkonto konnte nicht angelegt werden. Prüfe Kontokennung, Kontoname, Währung und Kontotyp.",
      },
      { status: 409 },
    );
  }
}
