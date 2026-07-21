import type { AppDatabase } from "../db/client";
import { rentalInquiryBikes, rentalInquiries } from "../db/schema";
import type { ContactInquiry } from "./schemas";

export function saveRentalInquiry(
  db: AppDatabase,
  payload: ContactInquiry,
  orderNumber: string,
  submittedAt = new Date(),
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
        locale: payload.locale,
        mailStatus: "sent",
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

    return inquiry;
  });
}
