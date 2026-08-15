"use client";

import { PlusIcon } from "lucide-react";

import {
  ManualBookingForm,
  type ManualBookingAsset,
  type ManualBookingInitialValues,
  type ManualBookingPricing,
} from "@/components/manual-booking-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RepeatBookingDialog({
  assets,
  pricingByLocation,
  initialValues,
}: {
  assets: ManualBookingAsset[];
  pricingByLocation: Record<string, ManualBookingPricing>;
  initialValues: ManualBookingInitialValues;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PlusIcon className="mr-2 size-4" />
        Weitere Buchung anlegen
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weitere Buchung für {initialValues.name}</DialogTitle>
          <DialogDescription>
            Die Kundendaten und Fahrradwünsche sind übernommen. Zeitraum, Zeiten und Preis bitte für die neue Anfrage
            ergänzen.
          </DialogDescription>
        </DialogHeader>
        <ManualBookingForm assets={assets} pricingByLocation={pricingByLocation} initialValues={initialValues} />
      </DialogContent>
    </Dialog>
  );
}
