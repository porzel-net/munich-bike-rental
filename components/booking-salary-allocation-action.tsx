"use client";

import { useState } from "react";
import { ChevronRightIcon, WalletCardsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

export type BookingSalaryRecipientUser = { id: string; name: string };

export function BookingSalaryAllocationAction({
  bookingId,
  recipients,
  selectedRecipientIds,
  isAdmin,
}: {
  bookingId: number;
  recipients: BookingSalaryRecipientUser[];
  selectedRecipientIds: string[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState(selectedRecipientIds);
  const allRecipientIds = recipients.map((recipient) => recipient.id);
  const isEvenlyAssigned =
    selectedIds.length === allRecipientIds.length &&
    selectedIds.every((recipientId) => allRecipientIds.includes(recipientId));
  function openDialog() {
    setSelectedIds(selectedRecipientIds);
    setOpen(true);
  }

  function setEvenAllocation(checked: boolean) {
    if (checked) {
      setSelectedIds(allRecipientIds);
      return;
    }
    setSelectedIds((current) => [current[0] ?? allRecipientIds[0]].filter(Boolean));
  }

  function toggleRecipient(userId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, userId])];
      return current.filter((id) => id !== userId);
    });
  }

  async function save() {
    if (!selectedIds.length) {
      toast.error("Wähle mindestens eine Person für die Gehaltszuweisung aus.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/salary-recipients`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserIds: selectedIds }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Die Gehaltszuweisung konnte nicht gespeichert werden.");
      toast.success("Gehaltszuweisung wurde gespeichert.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Die Gehaltszuweisung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Item
        className="min-h-0 cursor-pointer gap-3 px-3 py-2.5 text-left hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
        render={<button type="button" disabled={!isAdmin || busy || !recipients.length} onClick={openDialog} />}
        variant="muted"
      >
        <ItemMedia variant="icon" className="mt-0.5 self-start text-muted-foreground [&_svg]:size-3.5">
          <WalletCardsIcon />
        </ItemMedia>
        <ItemContent className="self-start">
          <ItemTitle className="line-clamp-none">Gehaltszuweisung</ItemTitle>
          <ItemDescription className="line-clamp-none">Erlös auf Mitarbeitende verteilen</ItemDescription>
        </ItemContent>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Item>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gehaltszuweisung</DialogTitle>
            <DialogDescription>
              Lege fest, welche Personen den Erlös dieser Buchung in ihrer Gehaltsübersicht erhalten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/25 p-4 text-sm">
              <Checkbox checked={isEvenlyAssigned} onCheckedChange={(checked) => setEvenAllocation(Boolean(checked))} />
              <span>
                <span className="font-medium">Gleichmäßig</span>
                <span className="mt-1 block text-muted-foreground">Auf alle Mitarbeitenden gleichmäßig verteilen.</span>
              </span>
            </label>
            {!isEvenlyAssigned ? (
              <Field>
                <FieldLabel>Einzelne Mitarbeitende</FieldLabel>
                <div className="mt-2 divide-y rounded-xl border">
                  {recipients.map((recipient) => (
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm" key={recipient.id}>
                      <Checkbox
                        checked={selectedIds.includes(recipient.id)}
                        onCheckedChange={(checked) => toggleRecipient(recipient.id, Boolean(checked))}
                      />
                      <span>{recipient.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={busy || !selectedIds.length} onClick={() => void save()}>
              {busy ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
