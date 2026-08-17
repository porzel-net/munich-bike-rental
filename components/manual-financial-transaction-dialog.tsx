"use client";

import { useState } from "react";

import type {
  FinancialReviewAccount,
  FinancialReviewBooking,
  FinancialReviewCategory,
} from "@/components/financial-review-inbox";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { Button } from "@/components/ui/button";

export function ManualFinancialTransactionLauncher({
  categories,
  accounts,
  bookings,
  onCompleted,
}: {
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  bookings: FinancialReviewBooking[];
  onCompleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Manuelle Transaktion
      </Button>
      <FinancialTransactionDialog
        mode="manual"
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        accounts={accounts}
        bookings={bookings}
        onManualCompleted={() => onCompleted?.()}
      />
    </>
  );
}
