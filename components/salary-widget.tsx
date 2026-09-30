import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SalaryBreakdown } from "@/lib/financial/salary-allocation";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatRate(basisPoints: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(basisPoints / 10_000);
}

export function SalaryWidget({ breakdown, year }: { breakdown: SalaryBreakdown; year: number }) {
  const taxLabel =
    breakdown.incomeTaxBasisPoints === null
      ? "Einkommensteuer (nicht festgelegt)"
      : `Einkommensteuer (${formatRate(breakdown.incomeTaxBasisPoints)})`;
  const totalLabel = breakdown.incomeTaxCents === null ? "Anteil vor Einkommensteuer" : "Netto Gehalt";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{breakdown.employeeName}</CardTitle>
        <CardAction>
          <Badge variant="secondary">Gehalt {year}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Gehalt</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(breakdown.salaryCents)}</TableCell>
            </TableRow>
            {breakdown.expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  {expense.href ? (
                    <Link className="block hover:underline focus-visible:underline" href={expense.href}>
                      {expense.label}
                    </Link>
                  ) : (
                    expense.label
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {expense.href ? (
                    <Link className="block hover:underline focus-visible:underline" href={expense.href}>
                      {formatCurrency(-expense.amountCents)}
                    </Link>
                  ) : (
                    formatCurrency(-expense.amountCents)
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="text-right">Anteil nach zugeordneten Ausgaben</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(breakdown.afterExpensesCents)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-right">{taxLabel}</TableCell>
              <TableCell className="text-right tabular-nums">
                {breakdown.incomeTaxCents === null ? "–" : formatCurrency(-breakdown.incomeTaxCents)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-right font-semibold">{totalLabel}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(breakdown.payoutCents)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
