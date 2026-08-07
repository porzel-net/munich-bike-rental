import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingAdminContext } from "@/lib/bookings/admin-guard";
import { BookingCommandError } from "@/lib/bookings/errors";
import { previewOffer } from "@/lib/bookings/service";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({
  assetsByRequestedItem: z.record(z.string(), z.number().int().positive()),
  accessoriesByRequestedItem: z
    .record(
      z.string(),
      z.object({
        needsPedals: z.boolean(),
        pedalType: z.string().nullable(),
        needsComputerMount: z.boolean(),
        computerMountType: z.string().nullable(),
        needsHelmet: z.boolean(),
        needsClothing: z.boolean(),
      }),
    )
    .optional(),
  alternative: z.boolean().optional(),
  alternativeReason: z.string().trim().max(1000).optional(),
  personalMessage: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  const input = schema.safeParse(await readBoundedJson(request));
  const command = await getBookingAdminContext(request, id, { requireAssignee: true });
  if (!command || !input.success) return NextResponse.json({ message: "Invalid preview" }, { status: 400 });
  try {
    return NextResponse.json(
      previewOffer(command.db, {
        bookingId: id,
        assetsByRequestedItem: Object.fromEntries(
          Object.entries(input.data.assetsByRequestedItem).map(([key, value]) => [Number(key), value]),
        ),
        accessoriesByRequestedItem: input.data.accessoriesByRequestedItem
          ? Object.fromEntries(
              Object.entries(input.data.accessoriesByRequestedItem).map(([key, value]) => [Number(key), value]),
            )
          : undefined,
        alternative: input.data.alternative,
        alternativeReason: input.data.alternativeReason,
        personalMessage: input.data.personalMessage,
        actorUserId: command.user.id,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof BookingCommandError ? error.message : "Preview failed" },
      { status: 409 },
    );
  }
}
