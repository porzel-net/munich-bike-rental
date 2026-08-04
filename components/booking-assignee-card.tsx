"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
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
}: BookingAssigneeCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(assignee?.id ?? "");

  const currentUserIsAssignee = assignee?.id === currentUserId;
  const selectedUser = eligibleUsers.find((user) => user.id === selectedUserId) ?? null;
  const assigneeItems = eligibleUsers.map((user) => ({
    value: user.id,
    label: `${user.name} · ${assigneeRoleLabel(user, bookingLocationLabel)}`,
  }));

  function openDialog() {
    setSelectedUserId(assignee?.id ?? (isAdmin ? eligibleUsers[0]?.id ?? "" : currentUserId));
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
      if (!response.ok) throw new Error(result?.message ?? "Sachbearbeiter konnte nicht gespeichert werden.");
      toast.success("Sachbearbeiter wurde gespeichert.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sachbearbeiter konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = assignee ? "Sachbearbeiter ändern" : "Sachbearbeiter wählen";

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog}>
        {actionLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogDescription>{bookingLocationLabel} · Zuständigkeit für diese Buchung</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {assignee ? (
              <div className="rounded-lg border bg-muted/25 px-3 py-2 text-sm">
                <div className="font-medium">{assignee.name}</div>
                <div className="text-muted-foreground">
                  {assignee.email} · {assigneeRoleLabel(assignee, bookingLocationLabel)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                Kein Sachbearbeiter ist bisher eingetragen.
              </div>
            )}

            {isAdmin ? (
              <Field>
                <FieldLabel htmlFor={`assignee-${bookingId}`}>Sachbearbeiter wählen</FieldLabel>
                <Select
                  items={assigneeItems}
                  value={selectedUserId}
                  onValueChange={(value) => setSelectedUserId(value ?? "")}
                >
                  <SelectTrigger id={`assignee-${bookingId}`} className="w-full">
                    <SelectValue className="text-sm font-normal">{selectedUser?.name ?? "Sachbearbeiter wählen"}</SelectValue>
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
              <p className="text-sm text-muted-foreground">
                Du kannst dich hier selbst als Sachbearbeiter eintragen.
              </p>
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
                  if (!selectedUserId) {
                    toast.error("Bitte wähle zuerst einen Sachbearbeiter aus.");
                    return;
                  }
                  void saveAssignee(selectedUserId);
                }}
              >
                {busy ? "Speichern…" : "Zuweisen"}
              </Button>
            ) : canSelfAssign ? (
              <Button type="button" disabled={busy} onClick={() => void saveAssignee(currentUserId)}>
                {busy ? "Speichern…" : "Mich eintragen"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
