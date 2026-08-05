"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookingPreflightDetails, BookingPreflightStatusBadge } from "@/components/booking-preflight-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BookingMigrationPreflight } from "@/lib/bookings/preflight";

export function BookingPreflightDialog({ result }: { result: BookingMigrationPreflight }) {
  const issueCount = result.unmapped.length + result.allocationConflicts.length;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Mögliche Probleme
        {!result.ok && (
          <Badge className="ml-1" variant="destructive">
            {issueCount}
          </Badge>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Mögliche Probleme
            <BookingPreflightStatusBadge result={result} />
          </DialogTitle>
          <DialogDescription>
            Hier siehst du, ob deine Buchungen vollständig vorbereitet sind und sich keine Fahrräder überschneiden.
          </DialogDescription>
        </DialogHeader>
        <BookingPreflightDetails result={result} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Schließen</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
