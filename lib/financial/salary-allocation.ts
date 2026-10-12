import type { EuerSummary } from "./euer";

export type SalaryPerson = { id: string; name: string };

export type SalaryExpenseLine = {
  id: number;
  label: string;
  amountCents: number;
  href: string | null;
};

export type SalaryIncomeLine = {
  month: string;
  amountCents: number;
};

export type SalaryBreakdown = {
  employeeId: string;
  employeeName: string;
  salaryCents: number;
  salaryLines: SalaryIncomeLine[];
  expenses: SalaryExpenseLine[];
  afterExpensesCents: number;
  incomeTaxBasisPoints: number | null;
  incomeTaxCents: number | null;
  payoutCents: number;
};

function profitContribution(row: EuerSummary["rows"][number]) {
  if (row.euerTreatment === "income") return row.amountCents;
  if (row.euerTreatment === "expense" || row.euerTreatment === "tax_payment") return -Math.abs(row.amountCents);
  return 0;
}

/**
 * Splits the EÜR profit equally among admins while assigning each directly
 * attributed, deductible expense to its selected admin exactly once.
 */
export function buildSalaryBreakdowns(
  summary: EuerSummary,
  admins: SalaryPerson[],
  incomeTaxBasisPoints: number | null,
): SalaryBreakdown[] {
  if (!admins.length) return [];

  const adminIds = new Set(admins.map((admin) => admin.id));
  const assignedExpenses = summary.rows
    .filter(
      (row) =>
        row.euerTreatment === "expense" &&
        row.internalPersonId !== null &&
        row.internalPersonId !== undefined &&
        adminIds.has(row.internalPersonId),
    )
    .map((row) => {
      const href = row.transactionId
        ? `/admin/accounting/transactions?transaction=${row.transactionId}`
        : row.sourceTransactionId
          ? `/admin/accounting/transactions?transaction=${row.sourceTransactionId}`
          : null;
      return {
        personId: row.internalPersonId!,
        id: row.id,
        label: row.source === "depreciation" ? `Abschreibung · ${row.description}` : row.description || row.category,
        amountCents: Math.abs(row.amountCents),
        href,
      };
    });

  const assignedExpenseTotal = assignedExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const distributableBeforePersonalExpenses = summary.profitCents + assignedExpenseTotal;
  const assignedExpensesById = new Map(assignedExpenses.map((expense) => [expense.id, expense]));
  const monthlyDistributableAmounts = new Map<string, number>();
  for (const row of summary.rows) {
    const month = row.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const assignedExpense = assignedExpensesById.get(row.id);
    const amount = profitContribution(row) + (assignedExpense?.amountCents ?? 0);
    if (amount !== 0) monthlyDistributableAmounts.set(month, (monthlyDistributableAmounts.get(month) ?? 0) + amount);
  }

  // A summary can contain legacy rows without a valid date. Keep their share
  // visible instead of silently dropping it from the payout calculation.
  const monthlyTotal = [...monthlyDistributableAmounts.values()].reduce((sum, amount) => sum + amount, 0);
  if (monthlyTotal !== distributableBeforePersonalExpenses) {
    monthlyDistributableAmounts.set("ohne-monat", distributableBeforePersonalExpenses - monthlyTotal);
  }
  const monthlySalaryLines = [...monthlyDistributableAmounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, distributableCents]) => ({ month, distributableCents }));
  const salaryLinesByAdmin: SalaryIncomeLine[][] = admins.map(() => []);
  let nextAdminForExtraCent = 0;
  for (const { month, distributableCents } of monthlySalaryLines) {
    const equalShareBase = Math.floor(distributableCents / admins.length);
    const extraCents = distributableCents - equalShareBase * admins.length;
    const recipients = new Set<number>();
    for (let extraCent = 0; extraCent < extraCents; extraCent += 1) {
      recipients.add(nextAdminForExtraCent);
      nextAdminForExtraCent = (nextAdminForExtraCent + 1) % admins.length;
    }
    for (const [index] of admins.entries()) {
      salaryLinesByAdmin[index].push({
        month,
        amountCents: equalShareBase + (recipients.has(index) ? 1 : 0),
      });
    }
  }

  return admins.map((admin, index) => {
    const salaryLines = salaryLinesByAdmin[index];
    const salaryCents = salaryLines.reduce((sum, line) => sum + line.amountCents, 0);
    const expenses = assignedExpenses
      .filter((expense) => expense.personId === admin.id)
      .map((expense) => ({
        id: expense.id,
        label: expense.label,
        amountCents: expense.amountCents,
        href: expense.href,
      }));
    const afterExpensesCents = salaryCents - expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const incomeTaxCents =
      incomeTaxBasisPoints === null
        ? null
        : Math.round((Math.max(0, afterExpensesCents) * incomeTaxBasisPoints) / 10_000);

    return {
      employeeId: admin.id,
      employeeName: admin.name,
      salaryCents,
      salaryLines,
      expenses,
      afterExpensesCents,
      incomeTaxBasisPoints,
      incomeTaxCents,
      payoutCents: incomeTaxCents === null ? afterExpensesCents : afterExpensesCents - incomeTaxCents,
    };
  });
}
