import { NextResponse } from "next/server";
import { z } from "zod";

import { FeedbackError, submitPublicFeedback } from "@/lib/bookings/feedback";
import { getDatabase } from "@/lib/db/client";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  bikeRating: z.number().int().min(1).max(5),
  handoverRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  priceRating: z.number().int().min(1).max(5),
  overallRating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2_000),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const input = feedbackSchema.safeParse(await readBoundedJson(request));
  if (!input.success)
    return NextResponse.json({ message: "Bitte bewerte alle Punkte und prüfe den Kommentar." }, { status: 400 });
  try {
    submitPublicFeedback(getDatabase(), token, input.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof FeedbackError ? error.message : "Feedback konnte nicht gespeichert werden." },
      { status: error instanceof FeedbackError ? 400 : 500 },
    );
  }
}
