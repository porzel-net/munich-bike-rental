import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicOffer } from "@/components/public-offer";
import { getPublicBookingByToken, getPublicOfferByToken } from "@/lib/bookings/public";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = getDatabase();
  const offer = getPublicOfferByToken(database, token) ?? getPublicBookingByToken(database, token);
  if (!offer) notFound();
  return <PublicOffer offer={offer} token={token} />;
}
