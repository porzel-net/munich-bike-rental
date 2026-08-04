"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";

import { AccountingExpenseDialog } from "@/components/accounting-expense-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AccountingExpense = {
  id: number;
  description: string;
  payeeName: string;
  paymentDate: string | null;
  depreciationDurationMonths: number | null;
  sumCents: number;
  createdBy: string;
  createdAt: Date;
};

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

export function AccountingExpensesTable({ expenses }: { expenses: AccountingExpense[] }) {
  const [expenseRows, setExpenseRows] = useState(expenses);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    if (!query) return expenseRows;
    return expenseRows.filter((expense) =>
      [
        expense.description,
        expense.payeeName,
        expense.paymentDate ?? "",
        expense.depreciationDurationMonths?.toString() ?? "",
        expense.createdBy,
        (expense.sumCents / 100).toFixed(2),
        expense.sumCents.toString(),
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(query),
    );
  }, [expenseRows, search]);
  const totalAmountCents = filteredExpenses.reduce((total, expense) => total + expense.sumCents, 0);

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Aufwände</CardTitle>
            <CardDescription>Erfasste Aufwände und Abschreibungsinformationen.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Aufwände durchsuchen..."
                aria-label="Aufwände durchsuchen"
              />
            </InputGroup>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Neuen Aufwand hinzufügen"
              title="Neuen Aufwand hinzufügen"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Zahlungsempfänger</TableHead>
              <TableHead>Zahlungstag</TableHead>
              <TableHead>Abschreibung</TableHead>
              <TableHead>Erstellt am</TableHead>
              <TableHead>Erstellt von</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Noch keine Aufwände erfasst.
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>{expense.payeeName}</TableCell>
                  <TableCell>
                    {expense.paymentDate ? dateFormatter.format(new Date(`${expense.paymentDate}T00:00:00`)) : "—"}
                  </TableCell>
                  <TableCell>
                    {expense.depreciationDurationMonths
                      ? `${expense.depreciationDurationMonths} Monate`
                      : "Keine Abschreibung"}
                  </TableCell>
                  <TableCell>{dateFormatter.format(expense.createdAt)}</TableCell>
                  <TableCell>{expense.createdBy}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {euroFormatter.format(expense.sumCents / 100)}
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow>
              <TableCell colSpan={6}>Gesamtbetrag</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {euroFormatter.format(totalAmountCents / 100)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
      <AccountingExpenseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(expense) => {
          setExpenseRows((current) => [expense, ...current]);
          setCreateOpen(false);
        }}
      />
    </Card>
  );
}
