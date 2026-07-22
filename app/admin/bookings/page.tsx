import { desc, eq, inArray } from "drizzle-orm";

import { AdminBookingsTable, type AdminBooking } from "@/components/admin-bookings-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { accountingRevenues, rentalInquiryBikes, rentalInquiryMailActions, rentalInquiries } from "@/lib/db/schema";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";
import { expirePendingBookingConfirmations } from "@/lib/inquiries/confirmation";
import { redirect } from "next/navigation";

export default async function BookingsPage() {
  const session = await getServerSession();
  if (!session) return null;

  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  if (!administrator && !assignedLocation) redirect("/admin");

  const db = getDatabase();
  expirePendingBookingConfirmations(db);

  const inquiryQuery = db
    .select({
      id: rentalInquiries.id,
      orderNumber: rentalInquiries.orderNumber,
      name: rentalInquiries.name,
      location: rentalInquiries.location,
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      email: rentalInquiries.email,
      phone: rentalInquiries.phone,
      pickupTime: rentalInquiries.pickupTime,
      dropoffTime: rentalInquiries.dropoffTime,
      message: rentalInquiries.message,
      bikeTitle: rentalInquiries.bikeTitle,
      totalPriceCents: rentalInquiries.totalPriceCents,
      paidAmountCents: accountingRevenues.paidAmountCents,
      status: rentalInquiries.status,
      source: rentalInquiries.source,
    })
    .from(rentalInquiries)
    .leftJoin(accountingRevenues, eq(accountingRevenues.inquiryId, rentalInquiries.id))
    .orderBy(desc(rentalInquiries.submittedAt));

  const inquiries = (
    administrator ? inquiryQuery.all() : inquiryQuery.where(eq(rentalInquiries.location, assignedLocation!)).all()
  ) as Array<{
    id: number;
    orderNumber: string;
    name: string;
    location: string;
    periodFrom: string;
    periodTo: string;
    email: string;
    phone: string;
    pickupTime: string;
    dropoffTime: string;
    message: string;
    bikeTitle: string | null;
    totalPriceCents: number;
    paidAmountCents: number | null;
    status: "rejected" | "pending" | "confirmed" | "executed" | "cancelled" | "unanswered";
    source: "automatic" | "manual";
  }>;

  const allBikes = inquiries.length
    ? db
        .select({
          inquiryId: rentalInquiryBikes.inquiryId,
          heightCm: rentalInquiryBikes.heightCm,
          bikeSize: rentalInquiryBikes.bikeSize,
          needsPedals: rentalInquiryBikes.needsPedals,
          pedalType: rentalInquiryBikes.pedalType,
          needsComputerMount: rentalInquiryBikes.needsComputerMount,
          computerMountType: rentalInquiryBikes.computerMountType,
          needsHelmet: rentalInquiryBikes.needsHelmet,
          needsClothing: rentalInquiryBikes.needsClothing,
        })
        .from(rentalInquiryBikes)
        .where(
          inArray(
            rentalInquiryBikes.inquiryId,
            inquiries.map((inquiry) => inquiry.id),
          ),
        )
        .all()
    : [];
  const allMailActions = inquiries.length
    ? db
        .select({ inquiryId: rentalInquiryMailActions.inquiryId, action: rentalInquiryMailActions.action })
        .from(rentalInquiryMailActions)
        .where(
          inArray(
            rentalInquiryMailActions.inquiryId,
            inquiries.map((inquiry) => inquiry.id),
          ),
        )
        .all()
    : [];
  const mailActionsByInquiry = new Map<number, { confirmation: boolean; rejection: boolean }>();
  for (const action of allMailActions) {
    const current = mailActionsByInquiry.get(action.inquiryId) ?? { confirmation: false, rejection: false };
    current[action.action] = true;
    mailActionsByInquiry.set(action.inquiryId, current);
  }
  const bikesByInquiry = new Map<number, (typeof allBikes)[number][]>();
  for (const bike of allBikes) {
    const existing = bikesByInquiry.get(bike.inquiryId) ?? [];
    existing.push(bike);
    bikesByInquiry.set(bike.inquiryId, existing);
  }

  const bookings: AdminBooking[] = inquiries.map((inquiry) => ({
    ...inquiry,
    paidAmountCents: inquiry.paidAmountCents ?? 0,
    location: inquiry.location as RentalLocation,
    bikes: (bikesByInquiry.get(inquiry.id) ?? []).map((bike) => bike.bikeSize),
    bikeDetails: (bikesByInquiry.get(inquiry.id) ?? []).map((bike) => ({
      heightCm: bike.heightCm,
      bikeSize: bike.bikeSize,
      needsPedals: bike.needsPedals,
      pedalType: bike.pedalType,
      needsComputerMount: bike.needsComputerMount,
      computerMountType: bike.computerMountType,
      needsHelmet: bike.needsHelmet,
      needsClothing: bike.needsClothing,
    })),
    mailActions: mailActionsByInquiry.get(inquiry.id) ?? { confirmation: false, rejection: false },
  }));

  const availableLocations = (administrator ? rentalLocations : assignedLocation ? [assignedLocation] : []).map(
    (location) => ({ key: location, label: rentalLocationLabels.de[location] }),
  );
  const calendarFeedToken = process.env.CALENDAR_FEED_TOKEN?.trim();
  const calendarFeedUrl = calendarFeedToken
    ? new URL(
        `/api/calendar/${encodeURIComponent(calendarFeedToken)}.ics`,
        process.env.APP_ORIGIN?.trim() || process.env.SITE_URL?.trim() || "http://localhost:3000",
      ).toString()
    : null;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={administrator} variant="inset" />
      <SidebarInset>
        <SiteHeader title="Buchungen" />
        <main className="flex flex-1 flex-col p-4 lg:p-6">
          <AdminBookingsTable bookings={bookings} locations={availableLocations} calendarFeedUrl={calendarFeedUrl} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
