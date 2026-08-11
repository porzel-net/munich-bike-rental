import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedbackForm } from "@/components/feedback-form";
import { getPublicFeedbackByToken } from "@/lib/bookings/feedback";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const feedback = getPublicFeedbackByToken(getDatabase(), token);
  if (!feedback) notFound();
  return <FeedbackForm feedback={feedback} token={token} />;
}
