import type { AppDatabase } from "../db/client";
import { accountingRevenues, inquirySources, inquiryStatuses, rentalInquiryBikes, rentalInquiries } from "../db/schema";
import type { ContactInquiry } from "./schemas";

export function saveRentalInquiry(
  db: AppDatabase,
  payload: ContactInquiry,
  orderNumber: string,
  totalPriceCents: number,
  submittedAt = new Date(),
  status: (typeof inquiryStatuses)[number] = "unanswered",
  source: (typeof inquirySources)[number] = "automatic",
  mailThreadMessageId?: string | null,
) {
  return db.transaction((transaction) => {
    const inquiry = transaction
      .insert(rentalInquiries)
      .values({
        orderNumber,
        name: payload.name,
        email: payload.contact,
        phone: payload.phone,
        location: payload.location,
        periodFrom: payload.periodFrom,
        periodTo: payload.periodTo,
        pickupTime: payload.pickupTime,
        dropoffTime: payload.dropoffTime,
        message: payload.message,
        bikeTitle: payload.bikeTitle || null,
        affiliateKey: payload.affiliateKey || null,
        totalPriceCents,
        locale: payload.locale,
        mailStatus: "sent",
        status,
        source,
        mailThreadMessageId: mailThreadMessageId ?? null,
        mailSentAt: submittedAt,
        submittedAt,
      })
      .returning({ id: rentalInquiries.id })
      .get();

    transaction
      .insert(rentalInquiryBikes)
      .values(
        payload.bikes.map((bike, index) => ({
          inquiryId: inquiry.id,
          position: index + 1,
          heightCm: Number(bike.height),
          bikeSize: bike.bikeSize,
          needsPedals: bike.needsPedals,
          pedalType: bike.pedalType || null,
          needsComputerMount: bike.needsComputerMount,
          computerMountType: bike.computerMountType || null,
          needsHelmet: bike.needsHelmet,
          needsClothing: bike.needsClothing,
        })),
      )
      .run();

    if (status === "confirmed" || status === "cancelled") {
      transaction
        .insert(accountingRevenues)
        .values({
          inquiryId: inquiry.id,
          amountCents: status === "cancelled" ? Math.round(totalPriceCents / 2) : totalPriceCents,
          paidAmountCents: 0,
          paymentReceivedAt: null,
          payerName: payload.name,
          notes: "",
          createdAt: submittedAt,
          updatedAt: submittedAt,
        })
        .run();
    }

    return inquiry;
  });
}
