import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const inquiryLocales = ["de", "en"] as const;
export const inquiryMailStatuses = ["pending", "sent", "failed"] as const;
export const inquiryStatuses = ["rejected", "pending", "confirmed", "executed", "cancelled", "unanswered"] as const;
export const inquirySources = ["automatic", "manual"] as const;
export const inquiryMailActionTypes = ["confirmation", "rejection"] as const;

export const rentalInquiries = sqliteTable(
  "rental_inquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNumber: text("order_number").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    location: text("location").notNull(),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    pickupTime: text("pickup_time").notNull(),
    dropoffTime: text("dropoff_time").notNull(),
    message: text("message").notNull(),
    bikeTitle: text("bike_title"),
    affiliateKey: text("affiliate_key"),
    /** Final quote in cents at the moment the successfully mailed inquiry was created. */
    totalPriceCents: integer("total_price_cents").notNull().default(0),
    locale: text("locale", { enum: inquiryLocales }).notNull(),
    mailStatus: text("mail_status", { enum: inquiryMailStatuses }).notNull().default("pending"),
    status: text("status", { enum: inquiryStatuses }).notNull().default("unanswered"),
    source: text("source", { enum: inquirySources }).notNull().default("automatic"),
    mailThreadMessageId: text("mail_thread_message_id"),
    mailSentAt: integer("mail_sent_at", { mode: "timestamp_ms" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("rental_inquiries_order_number_unique").on(table.orderNumber),
    index("rental_inquiries_submitted_at_idx").on(table.submittedAt),
    index("rental_inquiries_mail_status_submitted_at_idx").on(table.mailStatus, table.submittedAt),
    index("rental_inquiries_status_submitted_at_idx").on(table.status, table.submittedAt),
    index("rental_inquiries_source_submitted_at_idx").on(table.source, table.submittedAt),
    check("rental_inquiries_locale_check", sql`${table.locale} in ('de', 'en')`),
    check("rental_inquiries_mail_status_check", sql`${table.mailStatus} in ('pending', 'sent', 'failed')`),
    check(
      "rental_inquiries_status_check",
      sql`${table.status} in ('rejected', 'pending', 'confirmed', 'executed', 'cancelled', 'unanswered')`,
    ),
    check("rental_inquiries_source_check", sql`${table.source} in ('automatic', 'manual')`),
  ],
);

export const rentalInquiryBikes = sqliteTable(
  "rental_inquiry_bikes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    inquiryId: integer("inquiry_id")
      .notNull()
      .references(() => rentalInquiries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    heightCm: integer("height_cm").notNull(),
    bikeSize: text("bike_size").notNull(),
    needsPedals: integer("needs_pedals", { mode: "boolean" }).notNull(),
    pedalType: text("pedal_type"),
    needsComputerMount: integer("needs_computer_mount", { mode: "boolean" }).notNull(),
    computerMountType: text("computer_mount_type"),
    needsHelmet: integer("needs_helmet", { mode: "boolean" }).notNull(),
    needsClothing: integer("needs_clothing", { mode: "boolean" }).notNull(),
    needsBikepackingBag: integer("needs_bikepacking_bag", { mode: "boolean" }).notNull().default(false),
    needsGlasses: integer("needs_glasses", { mode: "boolean" }).notNull().default(false),
    bottleHolderIncluded: integer("bottle_holder_included", { mode: "boolean" }).notNull().default(true),
    repairKitIncluded: integer("repair_kit_included", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("rental_inquiry_bikes_inquiry_position_unique").on(table.inquiryId, table.position),
    index("rental_inquiry_bikes_inquiry_id_idx").on(table.inquiryId),
  ],
);

export const rentalInquiryMailActions = sqliteTable(
  "rental_inquiry_mail_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    inquiryId: integer("inquiry_id")
      .notNull()
      .references(() => rentalInquiries.id, { onDelete: "cascade" }),
    action: text("action", { enum: inquiryMailActionTypes }).notNull(),
    messageId: text("message_id"),
    threadMessageId: text("thread_message_id"),
    mailboxMoved: integer("mailbox_moved", { mode: "boolean" }).notNull().default(false),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("rental_inquiry_mail_actions_inquiry_action_unique").on(table.inquiryId, table.action),
    index("rental_inquiry_mail_actions_inquiry_id_idx").on(table.inquiryId),
  ],
);

export const rentalBookingConfirmationTokens = sqliteTable(
  "rental_booking_confirmation_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    inquiryId: integer("inquiry_id")
      .notNull()
      .references(() => rentalInquiries.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("rental_booking_confirmation_tokens_hash_unique").on(table.tokenHash),
    index("rental_booking_confirmation_tokens_inquiry_id_idx").on(table.inquiryId),
    index("rental_booking_confirmation_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const rentalInquiryRelations = relations(rentalInquiries, ({ many }) => ({
  bikes: many(rentalInquiryBikes),
  mailActions: many(rentalInquiryMailActions),
  confirmationTokens: many(rentalBookingConfirmationTokens),
}));

export const rentalInquiryBikeRelations = relations(rentalInquiryBikes, ({ one }) => ({
  inquiry: one(rentalInquiries, {
    fields: [rentalInquiryBikes.inquiryId],
    references: [rentalInquiries.id],
  }),
}));

export const rentalInquiryMailActionRelations = relations(rentalInquiryMailActions, ({ one }) => ({
  inquiry: one(rentalInquiries, {
    fields: [rentalInquiryMailActions.inquiryId],
    references: [rentalInquiries.id],
  }),
}));

export const rentalBookingConfirmationTokenRelations = relations(rentalBookingConfirmationTokens, ({ one }) => ({
  inquiry: one(rentalInquiries, {
    fields: [rentalBookingConfirmationTokens.inquiryId],
    references: [rentalInquiries.id],
  }),
}));

export const rentalLocationBikes = sqliteTable(
  "rental_location_bikes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    bikeKey: text("bike_key").notNull(),
    title: text("title").notNull(),
    frameNumber: text("frame_number"),
    priceCentsPerDay: integer("price_cents_per_day").notNull(),
    discountTextDe: text("discount_text_de").notNull().default(""),
    discountTextEn: text("discount_text_en").notNull().default(""),
    descriptionDe: text("description_de").notNull(),
    descriptionEn: text("description_en").notNull(),
    image: text("image").notNull(),
    galleryJson: text("gallery_json").notNull(),
    factsJson: text("facts_json").notNull(),
    equipmentJson: text("equipment_json").notNull(),
    displayOrder: integer("display_order").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("rental_location_bikes_location_key_unique").on(table.location, table.bikeKey),
    index("rental_location_bikes_location_order_idx").on(table.location, table.displayOrder),
  ],
);

export const rentalLocationBikeSizes = sqliteTable(
  "rental_location_bike_sizes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    locationBikeId: integer("location_bike_id")
      .notNull()
      .references(() => rentalLocationBikes.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [uniqueIndex("rental_location_bike_sizes_bike_size_unique").on(table.locationBikeId, table.size)],
);

export const rentalLocationEquipment = sqliteTable(
  "rental_location_equipment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    equipmentKey: text("equipment_key").notNull(),
    category: text("category").notNull(),
    labelDe: text("label_de").notNull(),
    labelEn: text("label_en").notNull(),
    priceCents: integer("price_cents").notNull(),
    displayOrder: integer("display_order").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("rental_location_equipment_location_key_unique").on(table.location, table.equipmentKey),
    index("rental_location_equipment_location_category_idx").on(table.location, table.category, table.displayOrder),
  ],
);

export const rentalLocationDiscounts = sqliteTable(
  "rental_location_discounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    discountKey: text("discount_key").notNull(),
    labelDe: text("label_de").notNull(),
    labelEn: text("label_en").notNull(),
    percentage: integer("percentage").notNull(),
    weekdayFrom: integer("weekday_from"),
    weekdayTo: integer("weekday_to"),
    minimumRentalDays: integer("minimum_rental_days"),
    requiresStudent: integer("requires_student", { mode: "boolean" }).notNull().default(false),
    isStackable: integer("is_stackable", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("rental_location_discounts_location_key_unique").on(table.location, table.discountKey),
    index("rental_location_discounts_location_order_idx").on(table.location, table.displayOrder),
    check("rental_location_discounts_percentage_check", sql`${table.percentage} between 0 and 100`),
  ],
);
