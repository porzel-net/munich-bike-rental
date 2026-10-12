"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRightIcon, UserRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BookingAssigneeUser } from "@/lib/bookings/assignees";

type BookingAssigneeCardProps = {
  bookingId: number;
  bookingLocationLabel: string;
  assignee: BookingAssigneeUser | null;
  eligibleUsers: BookingAssigneeUser[];
  currentUserId: string;
  isAdmin: boolean;
  canSelfAssign: boolean;
  requiresCustomerNotification: boolean;
};

function assigneeRoleLabel(user: BookingAssigneeUser, bookingLocationLabel: string) {
  if (user.role === "admin") return "Admin";
  return `Standortuser · ${bookingLocationLabel}`;
}

export function BookingAssigneeCard({
  bookingId,
  bookingLocationLabel,
  assignee,
  eligibleUsers,
  currentUserId,
  isAdmin,
  canSelfAssign,
  requiresCustomerNotification,
}: BookingAssigneeCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(assignee?.id ?? "");
  const [pendingAssigneeUserId, setPendingAssigneeUserId] = useState<string | null>(null);

  const currentUserIsAssignee = assignee?.id === currentUserId;
  const selectedUser = eligibleUsers.find((user) => user.id === selectedUserId) ?? null;
  const assigneeItems = eligibleUsers.map((user) => ({
    value: user.id,
    label: `${user.name} · ${assigneeRoleLabel(user, bookingLocationLabel)}`,
  }));

  function openDialog() {
    setSelectedUserId(assignee?.id ?? (isAdmin ? (eligibleUsers[0]?.id ?? "") : currentUserId));
    setOpen(true);
  }

  async function saveAssignee(assigneeUserId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeUserId }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Der Sachbearbeiter konnte nicht gespeichert werden. Prüfe Standort, Buchungsstatus und bestehende Zuweisung.",
        );
      toast.success("Sachbearbeiter wurde gespeichert.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Der Sachbearbeiter konnte nicht gespeichert werden. Prüfe Standort, Buchungsstatus und bestehende Zuweisung.",
      );
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = assignee ? "Sachbearbeiter ändern" : "Sachbearbeiter wählen";

  function requestSave(assigneeUserId: string) {
    if (!assigneeUserId) {
      toast.error("Bitte wähle zuerst einen Sachbearbeiter aus.");
      return;
    }
    if (requiresCustomerNotification && assignee && assignee.id !== assigneeUserId) {
      setPendingAssigneeUserId(assigneeUserId);
      return;
    }
    void saveAssignee(assigneeUserId);
  }

  return (
    <>
      <Item
        className="min-h-0 cursor-pointer gap-3 px-3 py-2.5 text-left hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
        render={<button type="button" disabled={busy} onClick={openDialog} />}
        variant="muted"
      >
        <ItemMedia variant="icon" className="mt-0.5 self-start text-muted-foreground [&_svg]:size-3.5">
          <UserRoundIcon />
        </ItemMedia>
        <ItemContent className="self-start">
          <ItemTitle className="line-clamp-none">Zuständigkeit</ItemTitle>
          <ItemDescription className="line-clamp-none">Sachbearbeiter für diese Buchung festlegen</ItemDescription>
        </ItemContent>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Item>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogDescription>{bookingLocationLabel} · Zuständigkeit für diese Buchung</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!assignee ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                Kein Sachbearbeiter ist bisher eingetragen.
              </div>
            ) : null}

            {isAdmin ? (
              <Field>
                <FieldLabel htmlFor={`assignee-${bookingId}`}>Sachbearbeiter wählen</FieldLabel>
                <Select
                  items={assigneeItems}
                  value={selectedUserId}
                  onValueChange={(value) => setSelectedUserId(value ?? "")}
                >
                  <SelectTrigger id={`assignee-${bookingId}`} className="w-full">
                    <SelectValue className="text-sm font-normal">
                      {selectedUser?.name ?? "Sachbearbeiter wählen"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {assigneeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : currentUserIsAssignee ? (
              <Badge variant="outline">Du bist als Sachbearbeiter eingetragen</Badge>
            ) : canSelfAssign ? (
              <p className="text-sm text-muted-foreground">Du kannst dich hier selbst als Sachbearbeiter eintragen.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nur Admins können die Zuweisung ändern. Erst danach können Buchungsaktionen ausgeführt werden.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                disabled={busy || !selectedUserId}
                onClick={() => {
                  requestSave(selectedUserId);
                }}
              >
                {busy ? "Speichern…" : "Zuweisen"}
              </Button>
            ) : canSelfAssign ? (
              <Button type="button" disabled={busy} onClick={() => requestSave(currentUserId)}>
                {busy ? "Speichern…" : "Mich eintragen"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingAssigneeUserId !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingAssigneeUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kundin oder Kunden über die neue Zuständigkeit informieren</AlertDialogTitle>
            <AlertDialogDescription>
              Für diese Buchung ist bereits ein aktives Angebot versendet oder sie ist verbindlich gebucht. Nach dem
              Wechsel musst du die Kundin oder den Kunden selbst über die neue Zuständigkeit informieren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (pendingAssigneeUserId) void saveAssignee(pendingAssigneeUserId);
              }}
            >
              {busy ? "Speichern…" : "Trotzdem wechseln"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
