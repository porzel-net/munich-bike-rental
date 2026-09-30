import type { EuerSummary } from "./euer";

export type SalaryPerson = { id: string; name: string };

export type SalaryExpenseLine = {
  id: number;
  label: string;
  amountCents: number;
  href: string | null;
};

export type SalaryBreakdown = {
  employeeId: string;
  employeeName: string;
  salaryCents: number;
  expenses: SalaryExpenseLine[];
  afterExpensesCents: number;
  incomeTaxBasisPoints: number | null;
  incomeTaxCents: number | null;
  payoutCents: number;
};

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
  const equalShareBase = Math.floor(distributableBeforePersonalExpenses / admins.length);
  const extraCents = distributableBeforePersonalExpenses - equalShareBase * admins.length;

  return admins.map((admin, index) => {
    const salaryCents = equalShareBase + (index < extraCents ? 1 : 0);
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
      expenses,
      afterExpensesCents,
      incomeTaxBasisPoints,
      incomeTaxCents,
      payoutCents: incomeTaxCents === null ? afterExpensesCents : afterExpensesCents - incomeTaxCents,
    };
  });
}
