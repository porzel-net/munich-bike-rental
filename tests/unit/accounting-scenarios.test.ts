import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const stripeApi = vi.hoisted(() => ({
  getStripeCheckoutPaymentDetails: vi.fn(),
}));

vi.mock("../../lib/stripe", () => stripeApi);

import {
  authUser,
  bookingOffers,
  bookings,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  fixedAssets,
  journalEntries,
} from "../../lib/db/schema";
import { createDatabaseConnection } from "../../lib/db/client";
import { getFinancialAccountReconciliation, postFinancialTransaction } from "../../lib/financial/reconciliation";
import { getEuerSummary } from "../../lib/financial/euer";
import { createAndPostManualTransaction } from "../../lib/financial/manual-transactions";
import { disposeFixedAsset } from "../../lib/financial/fixed-assets";
import { importStripeCheckoutPayment } from "../../lib/financial/stripe-payment";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  stripeApi.getStripeCheckoutPaymentDetails.mockReset();
  while (connections.length) connections.pop()?.close();
});

function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const { db } = connection;
  db.insert(authUser)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const bank = db
    .insert(financialAccounts)
    .values({
      code: "scenario_bank",
      name: "Szenario-Bankkonto",
      type: "bank",
      provider: "test",
      currency: "EUR",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
  const cash = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get()!;
  const category = (code: string) =>
    db.select().from(financialCategories).where(eq(financialCategories.code, code)).get()!;
  return { connection, db, bank, cash, category };
}

function transaction(
  db: ReturnType<typeof setup>["db"],
  financialAccountId: number,
  amountCents: number,
  kind: "income" | "expense" | "refund" | "payout" = amountCents > 0 ? "income" : "expense",
) {
  return db
    .insert(financialTransactions)
    .values({
      financialAccountId,
      source: "bank",
      provider: "scenario",
      externalId: `scenario-${Date.now()}-${Math.random()}`,
      kind,
      status: "needs_review",
      amountCents,
      currency: "EUR",
      bookedAt: "2026-08-05",
      description: "Buchhaltungsszenario",
      importedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

function post(
  db: ReturnType<typeof setup>["db"],
  transactionId: number,
  categoryId: number,
  note: string,
  destinationAccountId?: number,
) {
  return postFinancialTransaction(db, {
    transactionId,
    categoryId,
    destinationAccountId,
    note,
    actorUserId: "admin",
  });
}

describe("end-to-end accounting scenarios", () => {
  it("reconciles a mixed operating year without leaking private or transfer movements into profit", () => {
    const { db, bank, cash, category } = setup();
    post(db, transaction(db, bank.id, 100_000).id, category("other_operating_income").id, "Sonstige Einnahmen");
    post(db, transaction(db, bank.id, -25_000).id, category("maintenance").id, "Reparatur");
    post(db, transaction(db, bank.id, -20_000).id, category("cash_withdrawal").id, "Kassenauffüllung", cash.id);
    post(db, transaction(db, bank.id, -5_000).id, category("private_payment").id, "Privat veranlasst");
    post(db, transaction(db, bank.id, -4_750).id, category("input_vat").id, "Vorsteuer");
    post(db, transaction(db, bank.id, 1_900).id, category("output_vat").id, "Umsatzsteuer");
    post(db, transaction(db, bank.id, -8_000).id, category("vat_payment").id, "USt-Zahlung");

    expect(getFinancialAccountReconciliation(db, bank.id).expectedBalanceCents).toBe(39_150);
    expect(getFinancialAccountReconciliation(db, cash.id).expectedBalanceCents).toBe(20_000);
    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 100_000,
      expenseCents: 33_000,
      profitCents: 67_000,
      vatPaymentCents: 8_000,
      inputVatCents: 4_750,
      outputVatCents: 1_900,
      unresolvedCents: 0,
      excludedInternalCents: 20_000,
    });
  });

  it("books a bank refund as a negative income and uses a refund journal kind", () => {
    const { db, bank, category } = setup();
    post(db, transaction(db, bank.id, 10_000).id, category("other_operating_income").id, "Zahlung");
    const refund = transaction(db, bank.id, -2_500, "refund");
    const result = post(db, refund.id, category("refund").id, "Rückerstattung");

    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.id, result.journalEntryId))
        .get(),
    ).toEqual({
      kind: "refund_issued",
    });
    expect(getFinancialAccountReconciliation(db, bank.id).expectedBalanceCents).toBe(7_500);
    expect(getEuerSummary(db, 2026)).toMatchObject({ incomeCents: 7_500, expenseCents: 0, profitCents: 7_500 });
  });

  it("allows an imported bank debit to be explicitly categorized as a refund", () => {
    const { db, bank, category } = setup();
    const refund = transaction(db, bank.id, -5_900, "expense");
    const result = post(db, refund.id, category("refund").id, "Rückerstattung an Kundin");

    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.id, result.journalEntryId))
        .get(),
    ).toEqual({ kind: "refund_issued" });
    expect(getEuerSummary(db, 2026)).toMatchObject({ incomeCents: -5_900, expenseCents: 0, profitCents: -5_900 });
    expect(getEuerSummary(db, 2026).rows).toContainEqual(
      expect.objectContaining({ categoryCode: "refund", amountCents: -5_900, euerTreatment: "income" }),
    );
  });

  it("keeps Stripe fees in expenses and Stripe payouts as balance-sheet transfers", async () => {
    const { db, bank, category } = setup();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "SCENARIO-STRIPE-1",
        customerName: "Scenario Customer",
        customerEmail: "scenario@example.com",
        customerPhone: "000",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "09:00",
        dropoffTime: "17:00",
        source: "manual",
        status: "confirmed",
        quotedTotalCents: 10_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: bookings.id })
      .get();
    db.insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber: 1,
        status: "accepted",
        tokenHash: "scenario-stripe-token",
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: new Date(),
        stripeSessionId: "cs_test_scenario",
        stripePaymentIntentId: "pi_test_scenario",
        totalCents: 10_000,
        createdAt: new Date(),
      })
      .run();
    stripeApi.getStripeCheckoutPaymentDetails.mockResolvedValue({
      session: {
        id: "cs_test_scenario",
        url: null,
        payment_status: "paid",
        amount_total: 10_000,
        currency: "eur",
        customer_email: "scenario@example.com",
        metadata: {
          booking_id: String(booking.id),
          booking_offer_id: "1",
        },
      },
      paymentIntentId: "pi_test_scenario",
      chargeId: "ch_test_scenario",
      balanceTransaction: {
        id: "txn_test_scenario",
        amount: 10_000,
        fee: 300,
        net: 9_700,
        currency: "eur",
        created: Math.floor(Date.UTC(2026, 7, 5) / 1_000),
        available_on: Math.floor(Date.UTC(2026, 7, 6) / 1_000),
      },
    });

    const imported = await importStripeCheckoutPayment(db, { sessionId: "cs_test_scenario", bookingId: booking.id });
    const payout = transaction(db, bank.id, 9_700, "payout");
    post(
      db,
      payout.id,
      category("internal_transfer").id,
      "Stripe-Auszahlung",
      db.select().from(financialAccounts).where(eq(financialAccounts.code, "stripe_main")).get()!.id,
    );

    const stripeTransaction = db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, imported.transactionId))
      .get()!;
    const allocations = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, imported.transactionId))
      .all();
    expect(stripeTransaction.status).toBe("posted");
    expect(allocations.map((allocation) => allocation.amountCents).sort((a, b) => a - b)).toEqual([-300, 10_000]);
    expect(getFinancialAccountReconciliation(db, bank.id).expectedBalanceCents).toBe(9_700);
    expect(getFinancialAccountReconciliation(db, stripeTransaction.financialAccountId).expectedBalanceCents).toBe(0);
    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 10_000,
      expenseCents: 300,
      profitCents: 9_700,
      excludedInternalCents: 9_700,
    });
  });

  it("rejects a Stripe import when the stored PaymentIntent or gross balance differs", async () => {
    const { db } = setup();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "SCENARIO-STRIPE-2",
        customerName: "Scenario Customer",
        customerEmail: "scenario@example.com",
        customerPhone: "000",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "09:00",
        dropoffTime: "17:00",
        source: "manual",
        status: "confirmed",
        quotedTotalCents: 10_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: bookings.id })
      .get();
    const offer = db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber: 1,
        status: "accepted",
        tokenHash: "scenario-stripe-token-2",
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: new Date(),
        stripeSessionId: "cs_test_scenario_2",
        stripePaymentIntentId: "pi_test_scenario_2",
        totalCents: 10_000,
        createdAt: new Date(),
      })
      .returning({ id: bookingOffers.id })
      .get();
    const baseDetails = {
      session: {
        id: "cs_test_scenario_2",
        url: null,
        payment_status: "paid",
        amount_total: 10_000,
        currency: "eur",
        customer_email: "scenario@example.com",
        metadata: { booking_id: String(booking.id), booking_offer_id: String(offer.id) },
      },
      chargeId: "ch_test_scenario_2",
      balanceTransaction: {
        id: "txn_test_scenario_2",
        amount: 10_000,
        fee: 300,
        net: 9_700,
        currency: "eur",
        created: Math.floor(Date.UTC(2026, 7, 5) / 1_000),
        available_on: Math.floor(Date.UTC(2026, 7, 6) / 1_000),
      },
    };
    stripeApi.getStripeCheckoutPaymentDetails.mockResolvedValue({
      ...baseDetails,
      paymentIntentId: "pi_test_other_scenario_2",
    });
    await expect(
      importStripeCheckoutPayment(db, { sessionId: "cs_test_scenario_2", bookingId: booking.id }),
    ).rejects.toThrow("gehört nicht sicher");

    stripeApi.getStripeCheckoutPaymentDetails.mockResolvedValue({
      ...baseDetails,
      paymentIntentId: "pi_test_scenario_2",
      balanceTransaction: { ...baseDetails.balanceTransaction, amount: 9_999 },
    });
    await expect(
      importStripeCheckoutPayment(db, { sessionId: "cs_test_scenario_2", bookingId: booking.id }),
    ).rejects.toThrow("gehört nicht sicher");
  });

  it("handles an asset lifecycle once: acquisition, AfA, sale and output VAT", () => {
    const { db, cash, category } = setup();
    const acquisition = createAndPostManualTransaction(db, {
      source: "cash",
      accountId: cash.id,
      bookedAt: "2026-01-15",
      amountCents: 119_000,
      categoryId: category("equipment_asset_purchase").id,
      description: "Fahrrad als Anlagegut",
      actorUserId: "admin",
      asset: {
        name: "Szenario-Fahrrad",
        assetType: "bike",
        acquisitionDate: "2026-01-15",
        inServiceDate: "2026-01-15",
        acquisitionCostCents: 100_000,
        inputVatCents: 19_000,
        usefulLifeMonths: 12,
      },
    });
    const asset = db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.sourceTransactionId, acquisition.transactionId))
      .get()!;
    const disposal = disposeFixedAsset(db, {
      assetId: asset.id,
      financialAccountId: cash.id,
      disposedAt: "2026-03-15",
      disposalProceedsCents: 50_000,
      disposalProceedsVatCents: 9_500,
      actorUserId: "admin",
    });

    expect(disposal.disposalTransactionId).not.toBeNull();
    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 50_000,
      expenseCents: 100_000,
      inputVatCents: 19_000,
      outputVatCents: 9_500,
      profitCents: -50_000,
    });
    expect(getEuerSummary(db, 2026).rows.filter((row) => row.fixedAssetId === asset.id)).toHaveLength(7);
  });
});
