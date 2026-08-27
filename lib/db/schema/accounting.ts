import { sql } from "drizzle-orm";
import { AnySQLiteColumn, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { authUser } from "./auth";
import { bookingOffers, bookingRequestedItems, bookings, journalEntries, rentalAssets } from "./booking";

/** The single persisted Nevlo OAuth token set. Token values are encrypted before storage. */
export const nevloOAuthTokens = sqliteTable("nevlo_oauth_tokens", {
  id: integer("id").primaryKey(),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * The accounting domain has two deliberately separate layers:
 *
 * - financial_* tables preserve what an external source reported and how it
 *   was matched; they are never overwritten by a later accounting correction.
 * - journal_* tables are the append-only, double-entry accounting record.
 *
 * Amounts are stored in the smallest currency unit. Positive amounts increase
 * the balance of the source account; negative amounts decrease it.
 */

export const accountingAccountTypes = ["asset", "liability", "equity", "revenue", "expense", "clearing"] as const;
export const financialAccountTypes = ["bank", "stripe_clearing", "cash", "card", "other"] as const;
export const financialAccountStatuses = ["active", "archived"] as const;
export const financialTransactionSources = ["bank", "stripe", "cash", "manual", "other"] as const;
export type FinancialTransactionSource = (typeof financialTransactionSources)[number];
export const financialTransactionKinds = [
  "payment",
  "refund",
  "fee",
  "payout",
  "transfer",
  "cash_withdrawal",
  "cash_expense",
  "bank_fee",
  "tax_payment",
  "income",
  "expense",
  "other",
] as const;
export type FinancialTransactionKind = (typeof financialTransactionKinds)[number];
export const financialTransactionStatuses = ["imported", "needs_review", "matched", "posted", "ignored"] as const;
export const financialAllocationKinds = [
  "booking_payment",
  "booking_refund",
  "revenue",
  "expense",
  "asset_acquisition",
  "fee",
  "transfer",
  "tax",
  "other",
] as const;
export const financialMatchMethods = ["automatic", "rule", "manual", "imported", "unmatched"] as const;
export const financialCounterpartyTypes = ["customer", "supplier", "employee", "platform", "other"] as const;
export const financialCategoryTypes = ["income", "expense", "fee", "transfer", "tax", "other"] as const;
export const financialEuerTreatments = [
  "income",
  "expense",
  "tax_payment",
  "input_vat",
  "output_vat",
  "asset_acquisition",
  "transfer",
  "excluded",
  "needs_review",
] as const;
export const financialEuerLines = [
  "rental_income",
  "other_operating_income",
  "services",
  "wages",
  "depreciation",
  "rent",
  "repairs",
  "insurance",
  "advertising",
  "office",
  "travel",
  "other_operating_expense",
  "vat",
  "asset_acquisition",
  "not_applicable",
] as const;
export const financialReconciliationKinds = ["stripe_payout", "bank_deposit", "manual_group"] as const;
export const financialReconciliationStatuses = ["open", "matched", "difference", "closed"] as const;
export const financialDocumentTypes = ["receipt", "invoice", "contract", "bank_statement", "other"] as const;
export const financialDocumentLinkTypes = ["evidence", "source", "correction", "related"] as const;
export const fixedAssetTypes = ["bike", "equipment", "other"] as const;
export const fixedAssetMethods = ["straight_line"] as const;
export const fixedAssetStatuses = ["active", "disposed"] as const;
export const fixedAssetDisposalReasons = ["sold", "scrapped", "private_withdrawal", "other"] as const;
export const fixedAssetAcquisitionSources = ["transaction", "private_contribution"] as const;

/** The chart of accounts used by journal lines. Existing journal account codes remain valid. */
export const accountingAccounts = sqliteTable(
  "accounting_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    accountType: text("account_type", { enum: accountingAccountTypes }).notNull(),
    parentCode: text("parent_code"),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("accounting_accounts_code_unique").on(table.code),
    index("accounting_accounts_type_active_idx").on(table.accountType, table.isActive),
  ],
);

/** User-facing categories map to a journal account while retaining business semantics. */
export const financialCategories = sqliteTable(
  "financial_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    categoryType: text("category_type", { enum: financialCategoryTypes }).notNull(),
    accountCode: text("account_code").notNull(),
    euerTreatment: text("euer_treatment", { enum: financialEuerTreatments }).notNull().default("needs_review"),
    euerLine: text("euer_line", { enum: financialEuerLines }).notNull().default("not_applicable"),
    parentId: integer("parent_id").references((): AnySQLiteColumn => financialCategories.id, { onDelete: "restrict" }),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_categories_code_unique").on(table.code),
    index("financial_categories_type_active_idx").on(table.categoryType, table.isActive),
    index("financial_categories_parent_idx").on(table.parentId),
  ],
);

/** Normalized payer/payee data. Transaction snapshots remain on the transaction for auditability. */
export const financialCounterparties = sqliteTable(
  "financial_counterparties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: financialCounterpartyTypes }).notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    email: text("email"),
    phone: text("phone"),
    ibanLast4: text("iban_last4"),
    taxNumber: text("tax_number"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("financial_counterparties_name_idx").on(table.displayName)],
);

/** Internal balances: operating bank account, Stripe clearing account, cash box, or another account. */
export const financialAccounts = sqliteTable(
  "financial_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: financialAccountTypes }).notNull(),
    status: text("status", { enum: financialAccountStatuses }).notNull().default("active"),
    iban: text("iban"),
    currency: text("currency").notNull().default("EUR"),
    provider: text("provider"),
    providerAccountId: text("provider_account_id"),
    openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
    openingBalanceDate: text("opening_balance_date"),
    providerBalanceCents: integer("provider_balance_cents"),
    providerBalanceAt: text("provider_balance_at"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_accounts_code_unique").on(table.code),
    index("financial_accounts_status_type_idx").on(table.status, table.type),
    check("financial_accounts_currency_check", sql`length(${table.currency}) = 3`),
  ],
);

/** Immutable normalized copy of a bank, Stripe, cash, or manually entered transaction. */
export const financialTransactions = sqliteTable(
  "financial_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    financialAccountId: integer("financial_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    source: text("source", { enum: financialTransactionSources }).notNull(),
    provider: text("provider"),
    externalId: text("external_id"),
    externalParentId: text("external_parent_id"),
    kind: text("kind", { enum: financialTransactionKinds }).notNull().default("other"),
    status: text("status", { enum: financialTransactionStatuses }).notNull().default("imported"),
    amountCents: integer("amount_cents").notNull(),
    grossAmountCents: integer("gross_amount_cents"),
    feeAmountCents: integer("fee_amount_cents"),
    netAmountCents: integer("net_amount_cents"),
    currency: text("currency").notNull().default("EUR"),
    bookedAt: text("booked_at").notNull(),
    valueDate: text("value_date"),
    counterpartyId: integer("counterparty_id").references(() => financialCounterparties.id, { onDelete: "set null" }),
    counterpartyNameSnapshot: text("counterparty_name_snapshot"),
    counterpartyEmailSnapshot: text("counterparty_email_snapshot"),
    counterpartyIbanLast4: text("counterparty_iban_last4"),
    reference: text("reference").notNull().default(""),
    description: text("description").notNull().default(""),
    bankTransactionCode: text("bank_transaction_code"),
    providerPayloadJson: text("provider_payload_json").notNull().default("{}"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    notes: text("notes").notNull().default(""),
    reconciledAt: integer("reconciled_at", { mode: "timestamp_ms" }),
    reconciledByUserId: text("reconciled_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    importedAt: integer("imported_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_transactions_source_account_external_unique").on(
      table.source,
      table.financialAccountId,
      table.externalId,
    ),
    index("financial_transactions_account_booked_idx").on(table.financialAccountId, table.bookedAt),
    index("financial_transactions_status_booked_idx").on(table.status, table.bookedAt),
    index("financial_transactions_kind_idx").on(table.kind),
    index("financial_transactions_counterparty_idx").on(table.counterpartyId),
    check("financial_transactions_amount_nonzero", sql`${table.amountCents} <> 0`),
    check("financial_transactions_currency_check", sql`length(${table.currency}) = 3`),
  ],
);

export const stripeRefundStatuses = ["pending", "succeeded", "posted", "failed"] as const;
export type StripeRefundStatus = (typeof stripeRefundStatuses)[number];

/** Durable state machine for Stripe refunds, including refunds created outside this application. */
export const stripeRefundOperations = sqliteTable(
  "stripe_refund_operations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => bookingOffers.id, { onDelete: "restrict" }),
    paymentIntentId: text("payment_intent_id").notNull(),
    stripeRefundId: text("stripe_refund_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    status: text("status", { enum: stripeRefundStatuses }).notNull().default("pending"),
    reason: text("reason").notNull(),
    failureMessage: text("failure_message"),
    financialTransactionId: integer("financial_transaction_id").references(() => financialTransactions.id, {
      onDelete: "restrict",
    }),
    journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("stripe_refund_operations_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("stripe_refund_operations_stripe_refund_unique").on(table.stripeRefundId),
    index("stripe_refund_operations_booking_status_idx").on(table.bookingId, table.status),
    index("stripe_refund_operations_payment_intent_idx").on(table.paymentIntentId),
    check("stripe_refund_operations_amount_positive", sql`${table.amountCents} > 0`),
    check("stripe_refund_operations_currency_check", sql`length(${table.currency}) = 3`),
  ],
);

/** A capitalized business asset with its tax-relevant acquisition data. */
export const fixedAssets = sqliteTable(
  "fixed_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetNumber: text("asset_number").notNull(),
    name: text("name").notNull(),
    assetType: text("asset_type", { enum: fixedAssetTypes }).notNull().default("other"),
    acquisitionSource: text("acquisition_source", { enum: fixedAssetAcquisitionSources })
      .notNull()
      .default("transaction"),
    serialNumber: text("serial_number"),
    acquisitionDate: text("acquisition_date").notNull(),
    inServiceDate: text("in_service_date").notNull(),
    acquisitionCostCents: integer("acquisition_cost_cents").notNull(),
    inputVatCents: integer("input_vat_cents").notNull().default(0),
    usefulLifeMonths: integer("useful_life_months").notNull(),
    method: text("method", { enum: fixedAssetMethods }).notNull().default("straight_line"),
    residualValueCents: integer("residual_value_cents").notNull().default(0),
    status: text("status", { enum: fixedAssetStatuses }).notNull().default("active"),
    disposedAt: text("disposed_at"),
    disposalReason: text("disposal_reason", { enum: fixedAssetDisposalReasons }),
    disposalProceedsCents: integer("disposal_proceeds_cents"),
    disposalProceedsVatCents: integer("disposal_proceeds_vat_cents").notNull().default(0),
    assetAccountCode: text("asset_account_code").notNull().default("fixed_assets_bikes"),
    accumulatedDepreciationAccountCode: text("accumulated_depreciation_account_code")
      .notNull()
      .default("accumulated_depreciation"),
    sourceTransactionId: integer("source_transaction_id").references(() => financialTransactions.id, {
      onDelete: "restrict",
    }),
    disposalTransactionId: integer("disposal_transaction_id").references(() => financialTransactions.id, {
      onDelete: "restrict",
    }),
    notes: text("notes").notNull().default(""),
    createdByUserId: text("created_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("fixed_assets_asset_number_unique").on(table.assetNumber),
    uniqueIndex("fixed_assets_source_transaction_unique").on(table.sourceTransactionId),
    uniqueIndex("fixed_assets_disposal_transaction_unique").on(table.disposalTransactionId),
    index("fixed_assets_status_idx").on(table.status),
    index("fixed_assets_acquisition_date_idx").on(table.acquisitionDate),
    check("fixed_assets_acquisition_cost_positive", sql`${table.acquisitionCostCents} > 0`),
    check("fixed_assets_input_vat_nonnegative", sql`${table.inputVatCents} >= 0`),
    check("fixed_assets_useful_life_positive", sql`${table.usefulLifeMonths} > 0`),
    check("fixed_assets_residual_value_nonnegative", sql`${table.residualValueCents} >= 0`),
  ],
);

/** A transaction may be split over several bookings, categories, or destination accounts. */
export const financialTransactionAllocations = sqliteTable(
  "financial_transaction_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => financialTransactions.id, { onDelete: "restrict" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    bookingRequestedItemId: integer("booking_requested_item_id").references(() => bookingRequestedItems.id, {
      onDelete: "restrict",
    }),
    rentalAssetId: integer("rental_asset_id").references(() => rentalAssets.id, { onDelete: "restrict" }),
    fixedAssetId: integer("fixed_asset_id").references(() => fixedAssets.id, { onDelete: "restrict" }),
    categoryId: integer("category_id").references(() => financialCategories.id, { onDelete: "restrict" }),
    counterpartyId: integer("counterparty_id").references(() => financialCounterparties.id, { onDelete: "set null" }),
    destinationAccountId: integer("destination_account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, { onDelete: "restrict" }),
    allocationKind: text("allocation_kind", { enum: financialAllocationKinds }).notNull(),
    matchMethod: text("match_method", { enum: financialMatchMethods }).notNull().default("unmatched"),
    matchScore: integer("match_score"),
    amountCents: integer("amount_cents").notNull(),
    note: text("note").notNull().default(""),
    matchedByUserId: text("matched_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    matchedAt: integer("matched_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("financial_transaction_allocations_transaction_idx").on(table.transactionId),
    index("financial_transaction_allocations_booking_idx").on(table.bookingId),
    index("financial_transaction_allocations_category_idx").on(table.categoryId),
    index("financial_transaction_allocations_fixed_asset_idx").on(table.fixedAssetId),
    index("financial_transaction_allocations_journal_idx").on(table.journalEntryId),
    check("financial_transaction_allocations_amount_nonzero", sql`${table.amountCents} <> 0`),
    check(
      "financial_transaction_allocations_target_check",
      sql`${table.bookingId} is not null or ${table.categoryId} is not null or ${table.destinationAccountId} is not null or ${table.fixedAssetId} is not null`,
    ),
  ],
);

/** Immutable monthly depreciation postings generated from the fixed asset register. */
export const fixedAssetDepreciationEntries = sqliteTable(
  "fixed_asset_depreciation_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fixedAssetId: integer("fixed_asset_id")
      .notNull()
      .references(() => fixedAssets.id, { onDelete: "restrict" }),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    amountCents: integer("amount_cents").notNull(),
    journalEntryId: integer("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("fixed_asset_depreciation_asset_period_unique").on(table.fixedAssetId, table.periodStart),
    index("fixed_asset_depreciation_period_idx").on(table.periodStart),
    check("fixed_asset_depreciation_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

/** Groups a Stripe payout with its underlying Stripe transactions and bank receipt. */
export const financialReconciliationGroups = sqliteTable(
  "financial_reconciliation_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: financialReconciliationKinds }).notNull(),
    status: text("status", { enum: financialReconciliationStatuses }).notNull().default("open"),
    externalId: text("external_id"),
    currency: text("currency").notNull().default("EUR"),
    expectedAmountCents: integer("expected_amount_cents").notNull().default(0),
    actualAmountCents: integer("actual_amount_cents").notNull().default(0),
    differenceCents: integer("difference_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    matchedAt: integer("matched_at", { mode: "timestamp_ms" }),
    matchedByUserId: text("matched_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_reconciliation_groups_kind_external_unique").on(table.kind, table.externalId),
    index("financial_reconciliation_groups_status_idx").on(table.status),
    check("financial_reconciliation_groups_currency_check", sql`length(${table.currency}) = 3`),
  ],
);

export const financialReconciliationMembers = sqliteTable(
  "financial_reconciliation_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => financialReconciliationGroups.id, { onDelete: "cascade" }),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => financialTransactions.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_reconciliation_members_group_transaction_unique").on(table.groupId, table.transactionId),
    index("financial_reconciliation_members_transaction_idx").on(table.transactionId),
    check("financial_reconciliation_members_amount_nonzero", sql`${table.amountCents} <> 0`),
  ],
);

/** Metadata for a receipt or invoice stored by the application or an object store. */
export const financialDocuments = sqliteTable(
  "financial_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentType: text("document_type", { enum: financialDocumentTypes }).notNull(),
    originalFileName: text("original_file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    documentDate: text("document_date"),
    description: text("description").notNull().default(""),
    uploadedByUserId: text("uploaded_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_documents_sha256_unique").on(table.sha256),
    index("financial_documents_date_idx").on(table.documentDate),
    check("financial_documents_size_nonnegative", sql`${table.sizeBytes} >= 0`),
  ],
);

/** Polymorphic evidence links keep receipts usable for transactions, allocations, and journal entries. */
export const financialDocumentLinks = sqliteTable(
  "financial_document_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => financialDocuments.id, { onDelete: "cascade" }),
    transactionId: integer("transaction_id").references(() => financialTransactions.id, { onDelete: "restrict" }),
    allocationId: integer("allocation_id").references(() => financialTransactionAllocations.id, {
      onDelete: "restrict",
    }),
    journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, { onDelete: "restrict" }),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    linkType: text("link_type", { enum: financialDocumentLinkTypes }).notNull().default("evidence"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("financial_document_links_document_transaction_unique").on(table.documentId, table.transactionId),
    index("financial_document_links_document_idx").on(table.documentId),
    index("financial_document_links_transaction_idx").on(table.transactionId),
    index("financial_document_links_booking_idx").on(table.bookingId),
    check(
      "financial_document_links_target_check",
      sql`${table.transactionId} is not null or ${table.allocationId} is not null or ${table.journalEntryId} is not null or ${table.bookingId} is not null`,
    ),
  ],
);
