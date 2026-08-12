"use client";

import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "standortuser";
  locationKey: string | null;
};

type AdminTeamTableProps = {
  users: TeamUser[];
  currentUserId: string;
  locationLabels: Record<string, string>;
};

function getInitials(name: string) {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase();
  return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
}

export function AdminTeamTable({ users: initialUsers, currentUserId, locationLabels }: AdminTeamTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [role, setRole] = useState<"admin" | "standortuser">("standortuser");
  const [locationKey, setLocationKey] = useState("munich");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "standortuser">("standortuser");
  const [inviteLocationKey, setInviteLocationKey] = useState("munich");
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  function openEdit(user: TeamUser) {
    setEditingUser(user);
    setRole(user.role);
    setLocationKey(user.locationKey ?? "munich");
    setMessage(null);
  }

  async function saveUser() {
    if (!editingUser) return;
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUser.id,
        role,
        locationKey: role === "standortuser" ? locationKey : null,
      }),
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage("Die Änderungen konnten nicht gespeichert werden.");
      return;
    }
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === editingUser.id
          ? { ...user, role, locationKey: role === "standortuser" ? locationKey : null }
          : user,
      ),
    );
    setEditingUser(null);
  }

  async function deleteUser(user: TeamUser) {
    if (!window.confirm(`Soll ${user.name} wirklich gelöscht werden?`)) return;
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!response.ok) {
      setMessage("Der Nutzer konnte nicht gelöscht werden.");
      return;
    }
    setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
  }

  async function createInvitation() {
    setIsInviting(true);
    setMessage(null);
    setInvitationLink(null);
    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName,
        role: inviteRole,
        locationKey: inviteRole === "standortuser" ? inviteLocationKey : null,
      }),
    });
    setIsInviting(false);
    if (!response.ok) {
      setMessage("Der Einladungslink konnte nicht erzeugt werden.");
      return;
    }
    const result = (await response.json()) as { invitation?: { link: string } };
    setInvitationLink(result.invitation?.link ?? null);
  }

  function closeInviteDialog(open: boolean) {
    setIsInviteOpen(open);
    if (!open) {
      setInviteName("");
      setInvitationLink(null);
      setMessage(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Team</h1>
            <p className="mt-2 text-sm text-muted-foreground">Nutzer und Berechtigungen verwalten.</p>
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => setIsInviteOpen(true)}>
            <Plus />
            <span className="sr-only">Neuen Einladungslink erstellen</span>
          </Button>
        </div>
        {message ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
          <CardContent className="p-0">
            <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
              <TableBody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="w-10">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                          <span className="text-sm font-semibold uppercase">{getInitials(user.name)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{user.role === "admin" ? "Admin" : "Standortuser"}</span>
                          <span>
                            {user.role === "admin"
                              ? "Alle Standorte"
                              : (user.locationKey && locationLabels[user.locationKey]) || "Kein Standort"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="w-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <MoreHorizontal />
                            <span className="sr-only">Aktionen für {user.name}</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)} disabled={isCurrentUser}>
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => void deleteUser(user)}
                              disabled={isCurrentUser}
                            >
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md p-0">
          <div className="rounded-4xl bg-card p-6 shadow-none ring-0">
            <div className="mb-6">
              <DialogHeader>
                <DialogTitle>Nutzer bearbeiten</DialogTitle>
                <DialogDescription>
                  {editingUser?.name} · {editingUser?.email}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="team-edit-role">Rolle</FieldLabel>
                  <Select value={role} onValueChange={(value) => value && setRole(value as typeof role)}>
                    <SelectTrigger id="team-edit-role" className="w-full">
                      <SelectValue>{role === "admin" ? "Admin" : "Standortuser"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="standortuser">Standortuser</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {role === "standortuser" ? (
                  <Field>
                    <FieldLabel htmlFor="team-edit-location">Standort</FieldLabel>
                    <Select value={locationKey} onValueChange={(value) => value && setLocationKey(value)}>
                      <SelectTrigger id="team-edit-location" className="w-full">
                        <SelectValue>{locationLabels[locationKey]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(locationLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Abbrechen
                </Button>
                <Button onClick={() => void saveUser()} disabled={isSaving}>
                  {isSaving ? "Speichern …" : "Speichern"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteOpen} onOpenChange={closeInviteDialog}>
        <DialogContent className="max-w-md p-0">
          <div className="rounded-4xl bg-card p-6 shadow-none ring-0">
            <div className="mb-6">
              <DialogHeader>
                <DialogTitle>Einladungslink erstellen</DialogTitle>
                <DialogDescription>Lege fest, wer dem Team beitreten darf.</DialogDescription>
              </DialogHeader>
            </div>
            <div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="team-invite-name">Name</FieldLabel>
                  <Input
                    id="team-invite-name"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Vorname Nachname"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team-invite-role">Rolle</FieldLabel>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => value && setInviteRole(value as typeof inviteRole)}
                  >
                    <SelectTrigger id="team-invite-role" className="w-full">
                      <SelectValue>{inviteRole === "admin" ? "Admin" : "Standortuser"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="standortuser">Standortuser</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {inviteRole === "standortuser" ? (
                  <Field>
                    <FieldLabel htmlFor="team-invite-location">Standort</FieldLabel>
                    <Select value={inviteLocationKey} onValueChange={(value) => value && setInviteLocationKey(value)}>
                      <SelectTrigger id="team-invite-location" className="w-full">
                        <SelectValue>{locationLabels[inviteLocationKey]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(locationLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {invitationLink ? (
                  <Field>
                    <FieldLabel htmlFor="team-invitation-link">Einladungslink</FieldLabel>
                    <div className="flex gap-2">
                      <Input id="team-invitation-link" className="min-w-0" value={invitationLink} readOnly />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void navigator.clipboard.writeText(invitationLink)}
                      >
                        Kopieren
                      </Button>
                    </div>
                  </Field>
                ) : null}
              </FieldGroup>
              {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => closeInviteDialog(false)}>
                  Schließen
                </Button>
                <Button onClick={() => void createInvitation()} disabled={isInviting || inviteName.trim().length < 2}>
                  {isInviting ? "Link wird erzeugt …" : "Link erstellen"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
