import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

import { authUser } from "./auth";

export const bookingStatuses = [
  "inquiry_received",
  "offer_sent",
  "confirmed",
  "checked_out",
  "completed",
  "rejected",
  "cancelled",
  "expired",
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingSources = ["web", "manual", "legacy"] as const;
export const communicationLocales = ["de", "en"] as const;
export const offerStatuses = ["sent", "accepted", "expired", "revoked"] as const;
export const assetStates = ["active", "maintenance", "retired"] as const;
export const outboxStatuses = ["queued", "leased", "sent", "failed"] as const;
export const ledgerEntryKinds = [
  "rental_charge",
  "cancellation_fee",
  "payment_received",
  "refund_issued",
  "credit_note",
  "expense",
  "bank_transfer",
  "stripe_fee",
  "cash_expense",
  "bank_fee",
  "tax_payment",
  "depreciation",
  "capital_contribution",
  "asset_disposal",
  "unclassified_transaction",
  "correction",
  "legacy_import",
] as const;

/** Product content shared by concrete, bookable rental assets. */
export const bikeModels = sqliteTable(
  "bike_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    modelKey: text("model_key").notNull(),
    title: text("title").notNull(),
    descriptionDe: text("description_de").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    image: text("image").notNull().default("/assets/img/svg/placeholder.svg"),
    galleryJson: text("gallery_json").notNull().default("[]"),
    factsJson: text("facts_json").notNull().default("[]"),
    equipmentJson: text("equipment_json").notNull().default('{"de":[],"en":[]}'),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    retiredAt: integer("retired_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("bike_models_location_key_unique").on(table.location, table.modelKey),
    index("bike_models_location_idx").on(table.location),
  ],
);

export const bikeVariants = sqliteTable(
  "bike_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelId: integer("model_id")
      .notNull()
      .references(() => bikeModels.id, { onDelete: "restrict" }),
    size: text("size").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("bike_variants_model_size_unique").on(table.modelId, table.size)],
);

/** One row represents one physical bike which can be allocated to exactly one booking at a time. */
export const rentalAssets = sqliteTable(
  "rental_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => bikeVariants.id, { onDelete: "restrict" }),
    location: text("location").notNull(),
    assetCode: text("asset_code").notNull(),
    nickname: text("nickname"),
    frameNumber: text("frame_number"),
    displayName: text("display_name").notNull(),
    weekdayPriceCents: integer("weekday_price_cents").notNull().default(4900),
    weekendPriceCents: integer("weekend_price_cents").notNull().default(6900),
    isVisibleOnLanding: integer("is_visible_on_landing", { mode: "boolean" }).notNull().default(true),
    isBookable: integer("is_bookable", { mode: "boolean" }).notNull().default(true),
    state: text("state", { enum: assetStates }).notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("rental_assets_location_code_unique").on(table.location, table.assetCode),
    index("rental_assets_location_state_idx").on(table.location, table.state),
    check("rental_assets_weekday_price_nonnegative", sql`${table.weekdayPriceCents} >= 0`),
    check("rental_assets_weekend_price_nonnegative", sql`${table.weekendPriceCents} >= 0`),
  ],
);

/** Counted accessories are allocated together with a confirmed booking. */
export const accessoryInventory = sqliteTable(
  "accessory_inventory",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    accessoryKey: text("accessory_key").notNull(),
    category: text("category").notNull(),
    labelDe: text("label_de").notNull(),
    labelEn: text("label_en").notNull(),
    priceCents: integer("price_cents").notNull(),
    availableQuantity: integer("available_quantity").notNull().default(0),
    quantityRelevant: integer("quantity_relevant", { mode: "boolean" }).notNull().default(true),
    state: text("state", { enum: assetStates }).notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("accessory_inventory_location_key_unique").on(table.location, table.accessoryKey),
    index("accessory_inventory_location_state_idx").on(table.location, table.state),
    check("accessory_inventory_price_nonnegative", sql`${table.priceCents} >= 0`),
    check("accessory_inventory_quantity_nonnegative", sql`${table.availableQuantity} >= 0`),
  ],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    legacyInquiryId: integer("legacy_inquiry_id").unique(),
    /** Stable identifiers used by the repeatable historical e-mail import. */
    legacySourceId: text("legacy_source_id"),
    legacyDedupeKey: text("legacy_dedupe_key"),
    /** Client-generated key that makes a retried public inquiry return the same booking. */
    submissionId: text("submission_id"),
    orderNumber: text("order_number").notNull(),
    assignedUserId: text("assigned_user_id").references(() => authUser.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    location: text("location").notNull(),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    pickupTime: text("pickup_time").notNull(),
    dropoffTime: text("dropoff_time").notNull(),
    customerMessage: text("customer_message").notNull().default(""),
    communicationLocale: text("communication_locale", { enum: communicationLocales }).notNull().default("de"),
    source: text("source", { enum: bookingSources }).notNull(),
    status: text("status", { enum: bookingStatuses }).notNull().default("inquiry_received"),
    invoiceNumber: text("invoice_number"),
    invoiceIssuedAt: integer("invoice_issued_at", { mode: "timestamp_ms" }),
    quotedTotalCents: integer("quoted_total_cents").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("bookings_order_number_unique").on(table.orderNumber),
    uniqueIndex("bookings_legacy_source_id_unique").on(table.legacySourceId),
    uniqueIndex("bookings_legacy_dedupe_key_unique").on(table.legacyDedupeKey),
    uniqueIndex("bookings_submission_id_unique").on(table.submissionId),
    uniqueIndex("bookings_invoice_number_unique").on(table.invoiceNumber),
    index("bookings_assigned_user_idx").on(table.assignedUserId),
    index("bookings_location_status_idx").on(table.location, table.status),
    index("bookings_created_at_idx").on(table.createdAt),
    check(
      "bookings_location_check",
      sql`${table.location} in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz')`,
    ),
    check("bookings_source_check", sql`${table.source} in ('web', 'manual', 'legacy')`),
    check(
      "bookings_status_check",
      sql`${table.status} in ('inquiry_received', 'offer_sent', 'confirmed', 'checked_out', 'completed', 'rejected', 'cancelled', 'expired')`,
    ),
    check("bookings_locale_check", sql`${table.communicationLocale} in ('de', 'en')`),
    check("bookings_period_order_check", sql`${table.periodFrom} <= ${table.periodTo}`),
    check("bookings_total_nonnegative", sql`${table.quotedTotalCents} >= 0`),
    check("bookings_version_positive", sql`${table.version} > 0`),
  ],
);

/** Stable customer-facing link for viewing the current booking state. */
export const bookingPublicLinks = sqliteTable(
  "booking_public_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("booking_public_links_booking_unique").on(table.bookingId),
    uniqueIndex("booking_public_links_token_hash_unique").on(table.tokenHash),
  ],
);

export const bookingRequestedItems = sqliteTable(
  "booking_requested_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    requestedLabel: text("requested_label").notNull(),
    heightCm: integer("height_cm").notNull(),
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
    insuranceProtectionSelected: integer("insurance_protection_selected", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("booking_requested_items_position_unique").on(table.bookingId, table.position),
    index("booking_requested_items_booking_idx").on(table.bookingId),
  ],
);

export const bookingOffers = sqliteTable(
  "booking_offers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    offerNumber: integer("offer_number").notNull(),
    status: text("status", { enum: offerStatuses }).notNull().default("sent"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    replacesOfferId: integer("replaces_offer_id"),
    /** The current Checkout Session for this offer; it is persisted before payment to prevent duplicates. */
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Immutable commercial snapshot for this particular offer version. */
    totalCents: integer("total_cents").notNull().default(0),
    priceSnapshotJson: text("price_snapshot_json").notNull().default("{}"),
    createdBy: text("created_by").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("booking_offers_booking_number_unique").on(table.bookingId, table.offerNumber),
    uniqueIndex("booking_offers_token_hash_unique").on(table.tokenHash),
    uniqueIndex("booking_offers_stripe_session_unique").on(table.stripeSessionId),
    index("booking_offers_booking_status_idx").on(table.bookingId, table.status),
    index("booking_offers_expiry_idx").on(table.expiresAt),
  ],
);

export const bookingOfferItems = sqliteTable(
  "booking_offer_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => bookingOffers.id, { onDelete: "restrict" }),
    requestedItemId: integer("requested_item_id")
      .notNull()
      .references(() => bookingRequestedItems.id, { onDelete: "restrict" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => rentalAssets.id, { onDelete: "restrict" }),
    itemPriceCents: integer("item_price_cents").notNull(),
  },
  (table) => [
    uniqueIndex("booking_offer_items_offer_requested_unique").on(table.offerId, table.requestedItemId),
    index("booking_offer_items_asset_idx").on(table.assetId),
    check("booking_offer_items_price_nonnegative", sql`${table.itemPriceCents} >= 0`),
  ],
);

export const bookingAssetAllocations = sqliteTable(
  "booking_asset_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => bookingOffers.id, { onDelete: "restrict" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => rentalAssets.id, { onDelete: "restrict" }),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    pickupTime: text("pickup_time").notNull(),
    dropoffTime: text("dropoff_time").notNull(),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("booking_asset_allocations_asset_period_idx").on(table.assetId, table.periodFrom, table.periodTo),
    index("booking_asset_allocations_booking_idx").on(table.bookingId),
    check("booking_asset_allocations_period_order_check", sql`${table.periodFrom} <= ${table.periodTo}`),
  ],
);

/** Quantified accessory allocation, released on cancellation like bike assets. */
export const bookingAccessoryAllocations = sqliteTable(
  "booking_accessory_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    accessoryId: integer("accessory_id")
      .notNull()
      .references(() => accessoryInventory.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    pickupTime: text("pickup_time").notNull(),
    dropoffTime: text("dropoff_time").notNull(),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("booking_accessory_allocations_booking_accessory_unique").on(table.bookingId, table.accessoryId),
    index("booking_accessory_allocations_accessory_period_idx").on(table.accessoryId, table.periodFrom, table.periodTo),
    check("booking_accessory_allocations_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const bookingEvents = sqliteTable(
  "booking_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status", { enum: bookingStatuses }),
    toStatus: text("to_status", { enum: bookingStatuses }),
    actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
    reason: text("reason"),
    payloadJson: text("payload_json").notNull().default("{}"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("booking_events_booking_occurred_idx").on(table.bookingId, table.occurredAt)],
);

export const communicationMessages = sqliteTable(
  "communication_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    rfcMessageId: text("rfc_message_id"),
    threadMessageId: text("thread_message_id"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    sender: text("sender").notNull(),
    recipients: text("recipients").notNull(),
    subject: text("subject").notNull(),
    plainText: text("plain_text").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("communication_messages_rfc_message_unique").on(table.rfcMessageId),
    index("communication_messages_booking_sent_idx").on(table.bookingId, table.sentAt),
  ],
);

export const emailActionReviewStatuses = ["needs_action", "no_action", "error"] as const;
export type EmailActionReviewStatus = (typeof emailActionReviewStatuses)[number];

/** The latest structured answer from the mail-action automation for a thread event. */
export const emailActionReviews = sqliteTable(
  "email_action_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    triggerMessageId: integer("trigger_message_id")
      .notNull()
      .references(() => communicationMessages.id, { onDelete: "restrict" }),
    status: text("status", { enum: emailActionReviewStatuses }).notNull(),
    source: text("source", { enum: ["inquiry_rule", "openai", "fallback"] }).notNull(),
    summary: text("summary").notNull(),
    openQuestionsJson: text("open_questions_json").notNull().default("[]"),
    model: text("model"),
    reasoningEffort: text("reasoning_effort"),
    promptVersion: text("prompt_version").notNull(),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("email_action_reviews_trigger_message_unique").on(table.triggerMessageId),
    index("email_action_reviews_booking_created_idx").on(table.bookingId, table.createdAt),
  ],
);

export const mailOutbox = sqliteTable(
  "mail_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    offerId: integer("offer_id").references(() => bookingOffers.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    locale: text("locale", { enum: communicationLocales }).notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    plainText: text("plain_text").notNull(),
    html: text("html"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    status: text("status", { enum: outboxStatuses }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }).notNull(),
    leasedAt: integer("leased_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    providerMessageId: text("provider_message_id"),
    sentMailboxPath: text("sent_mailbox_path"),
    sentMailboxAt: integer("sent_mailbox_at", { mode: "timestamp_ms" }),
    sentMailboxError: text("sent_mailbox_error"),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("mail_outbox_idempotency_unique").on(table.idempotencyKey),
    index("mail_outbox_status_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

/** One feedback link is created when a bike is handed over and can be submitted once. */
export const bookingFeedback = sqliteTable(
  "booking_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    bikeRating: integer("bike_rating"),
    handoverRating: integer("handover_rating"),
    communicationRating: integer("communication_rating"),
    priceRating: integer("price_rating"),
    overallRating: integer("overall_rating"),
    comment: text("comment").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("booking_feedback_booking_unique").on(table.bookingId),
    uniqueIndex("booking_feedback_token_hash_unique").on(table.tokenHash),
    index("booking_feedback_submitted_at_idx").on(table.submittedAt),
    check(
      "booking_feedback_bike_rating_check",
      sql`${table.bikeRating} is null or ${table.bikeRating} between 1 and 5`,
    ),
    check(
      "booking_feedback_handover_rating_check",
      sql`${table.handoverRating} is null or ${table.handoverRating} between 1 and 5`,
    ),
    check(
      "booking_feedback_communication_rating_check",
      sql`${table.communicationRating} is null or ${table.communicationRating} between 1 and 5`,
    ),
    check(
      "booking_feedback_price_rating_check",
      sql`${table.priceRating} is null or ${table.priceRating} between 1 and 5`,
    ),
    check(
      "booking_feedback_overall_rating_check",
      sql`${table.overallRating} is null or ${table.overallRating} between 1 and 5`,
    ),
  ],
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    /** Links a journal posting back to an imported or manually documented transaction. */
    financialTransactionId: integer("financial_transaction_id"),
    kind: text("kind", { enum: ledgerEntryKinds }).notNull(),
    reason: text("reason").notNull().default(""),
    /** Client-generated key for retry-safe manual payment/refund commands. */
    idempotencyKey: text("idempotency_key"),
    reversesEntryId: integer("reverses_entry_id"),
    actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("journal_entries_booking_occurred_idx").on(table.bookingId, table.occurredAt),
    index("journal_entries_financial_transaction_idx").on(table.financialTransactionId),
    index("journal_entries_reversal_idx").on(table.reversesEntryId),
    uniqueIndex("journal_entries_idempotency_unique").on(table.idempotencyKey),
  ],
);

export const journalLines = sqliteTable(
  "journal_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "restrict" }),
    account: text("account").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [
    index("journal_lines_entry_idx").on(table.entryId),
    check("journal_lines_nonzero", sql`${table.amountCents} <> 0`),
  ],
);
