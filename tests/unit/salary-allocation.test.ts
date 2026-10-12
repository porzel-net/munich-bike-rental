import { describe, expect, it } from "vitest";

import type { EuerSummary } from "../../lib/financial/euer";
import { buildSalaryBreakdowns } from "../../lib/financial/salary-allocation";

function summary(rows: EuerSummary["rows"]): EuerSummary {
  return {
    year: 2026,
    incomeCents: 0,
    expenseCents: 0,
    vatPaymentCents: 0,
    inputVatCents: 0,
    outputVatCents: 0,
    profitCents: rows.reduce((total, row) => {
      if (row.euerTreatment === "income") return total + row.amountCents;
      if (row.euerTreatment === "expense" || row.euerTreatment === "tax_payment")
        return total - Math.abs(row.amountCents);
      return total;
    }, 0),
    ebitdaCents: 0,
    outstandingCents: 0,
    postedDepreciationCents: 0,
    remainingDepreciationCents: 0,
    unresolvedCents: 0,
    excludedInternalCents: 0,
    rows,
  };
}

describe("buildSalaryBreakdowns", () => {
  it("shows each month's distributable result in a separate salary line", () => {
    const breakdown = buildSalaryBreakdowns(
      summary([
        {
          id: 1,
          date: "2026-01-15",
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "Januar-Einnahme",
          amountCents: 10_000,
          transactionId: 1,
          bookingId: null,
          invoiceNumber: null,
        },
        {
          id: 2,
          date: "2026-01-20",
          category: "Betriebsausgabe",
          categoryCode: "expense",
          euerTreatment: "expense",
          source: "bank",
          description: "Januar-Ausgabe",
          amountCents: -2_000,
          transactionId: 2,
          bookingId: null,
          invoiceNumber: null,
        },
        {
          id: 3,
          date: "2026-02-10",
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "Februar-Einnahme",
          amountCents: 5_000,
          transactionId: 3,
          bookingId: null,
          invoiceNumber: null,
        },
      ]),
      [{ id: "julius", name: "Julius" }],
      3_000,
    )[0];

    expect(breakdown.salaryLines).toEqual([
      { month: "2026-01", amountCents: 8_000 },
      { month: "2026-02", amountCents: 5_000 },
    ]);
    expect(breakdown.salaryCents).toBe(13_000);
    expect(breakdown.payoutCents).toBe(9_100);
  });

  it("adds a personal expense back only in its month before splitting salaries", () => {
    const breakdowns = buildSalaryBreakdowns(
      summary([
        {
          id: 1,
          date: "2026-03-15",
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "März-Einnahme",
          amountCents: 101,
          transactionId: 1,
          bookingId: null,
          invoiceNumber: null,
        },
        {
          id: 2,
          date: "2026-03-20",
          category: "Betriebsausgabe",
          categoryCode: "expense",
          euerTreatment: "expense",
          source: "bank",
          description: "Persönliche Ausgabe",
          amountCents: -25,
          internalPersonId: "julius",
          transactionId: 2,
          bookingId: null,
          invoiceNumber: null,
        },
      ]),
      [
        { id: "julius", name: "Julius" },
        { id: "lea", name: "Lea" },
      ],
      null,
    );

    expect(breakdowns.map((breakdown) => breakdown.salaryLines)).toEqual([
      [{ month: "2026-03", amountCents: 51 }],
      [{ month: "2026-03", amountCents: 50 }],
    ]);
    expect(breakdowns[0].afterExpensesCents).toBe(26);
    expect(breakdowns[1].afterExpensesCents).toBe(50);
  });

  it("keeps the annual cent allocation unchanged while showing monthly lines", () => {
    const breakdowns = buildSalaryBreakdowns(
      summary(
        ["2026-01-15", "2026-02-15"].map((date, index) => ({
          id: index + 1,
          date,
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "Monats-Einnahme",
          amountCents: 101,
          transactionId: index + 1,
          bookingId: null,
          invoiceNumber: null,
        })),
      ),
      [
        { id: "julius", name: "Julius" },
        { id: "lea", name: "Lea" },
      ],
      null,
    );

    expect(breakdowns.map((breakdown) => breakdown.salaryCents)).toEqual([101, 101]);
    expect(breakdowns.map((breakdown) => breakdown.salaryLines.map((line) => line.amountCents))).toEqual([
      [51, 50],
      [50, 51],
    ]);
  });

  it("assigns a booking's income only to its selected salary recipients", () => {
    const breakdowns = buildSalaryBreakdowns(
      summary([
        {
          id: 1,
          date: "2026-04-15",
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "Zugewiesene Buchung",
          amountCents: 10_000,
          transactionId: 1,
          bookingId: 42,
          invoiceNumber: null,
        },
        {
          id: 2,
          date: "2026-04-16",
          category: "Umsatz",
          categoryCode: "income",
          euerTreatment: "income",
          source: "bank",
          description: "Gemeinsame Einnahme",
          amountCents: 4_000,
          transactionId: 2,
          bookingId: null,
          invoiceNumber: null,
        },
      ]),
      [
        { id: "julius", name: "Julius" },
        { id: "lea", name: "Lea" },
      ],
      null,
      new Map([[42, ["julius"]]]),
    );

    expect(breakdowns.map((breakdown) => breakdown.salaryLines)).toEqual([
      [{ month: "2026-04", amountCents: 12_000 }],
      [{ month: "2026-04", amountCents: 2_000 }],
    ]);
  });
});
