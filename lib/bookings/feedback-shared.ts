export const feedbackCriteria = [
  { key: "bikeRating", de: "Fahrrad & Ausstattung", en: "Bike & equipment" },
  { key: "handoverRating", de: "Übergabe", en: "Handover" },
  { key: "communicationRating", de: "Kommunikation", en: "Communication" },
  { key: "priceRating", de: "Preis-Leistung", en: "Value for money" },
  { key: "overallRating", de: "Gesamterlebnis", en: "Overall experience" },
] as const;

export type FeedbackRatingKey = (typeof feedbackCriteria)[number]["key"];
export type FeedbackRatings = Record<FeedbackRatingKey, number>;
export type PublicFeedback = {
  bookingId: number;
  orderNumber: string;
  customerName: string;
  locale: "de" | "en";
  submittedAt: string | null;
  ratings: Record<FeedbackRatingKey, number | null>;
  comment: string;
};
