"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authClient } from "../lib/auth-client";

export function AdminDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "standortuser">("standortuser");
  const [locationKey, setLocationKey] = useState("munich");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setInvitationLink(null);
    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        locationKey: role === "standortuser" ? locationKey : null,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(result.message ?? "Der Einladungslink konnte nicht erzeugt werden. Prüfe Name, Rolle und Standort.");
      return;
    }

    const result = (await response.json()) as { invitation?: { link: string } };
    setName("");
    setInvitationLink(result.invitation?.link ?? null);
    setMessage("Einladungslink erzeugt. Er ist 24 Stunden gültig und nur einmal verwendbar.");
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="container py-12">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Geschützter Bereich</p>
          <h1 className="text-3xl font-semibold tracking-tight">Willkommen, {userName}</h1>
        </div>
        <Button variant="outline" type="button" onClick={signOut}>
          Abmelden
        </Button>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Einladung erzeugen</CardTitle>
          <CardDescription>
            Nur Admins können Einladungen erzeugen. Der Empfänger legt sein Passwort selbst fest und richtet danach die
            verpflichtende Authenticator-App ein.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={createInvitation}>
            <Field>
              <FieldLabel htmlFor="invitation-name">Name</FieldLabel>
              <Input id="invitation-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invitation-role">Rolle</FieldLabel>
              <Select value={role} onValueChange={(value) => value && setRole(value as typeof role)}>
                <SelectTrigger id="invitation-role" className="w-full">
                  <SelectValue>{role === "admin" ? "Admin" : "Standortuser"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standortuser">Standortuser</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {role === "standortuser" ? (
              <Field>
                <FieldLabel htmlFor="invitation-location">Zugeordneter Standort</FieldLabel>
                <Select value={locationKey} onValueChange={(value) => value && setLocationKey(value)}>
                  <SelectTrigger id="invitation-location" className="w-full">
                    <SelectValue>
                      {
                        {
                          munich: "München",
                          regensburg: "Regensburg",
                          lindau: "Lindau Bodensee",
                          friedrichshafen: "Friedrichshafen",
                          konstanz: "Konstanz",
                        }[locationKey]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="munich">München</SelectItem>
                    <SelectItem value="regensburg">Regensburg</SelectItem>
                    <SelectItem value="lindau">Lindau Bodensee</SelectItem>
                    <SelectItem value="friedrichshafen">Friedrichshafen</SelectItem>
                    <SelectItem value="konstanz">Konstanz</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Link wird erzeugt …" : "Einladungslink erzeugen"}
            </Button>
          </form>
          {message ? (
            <p className="mt-4 rounded-3xl bg-muted p-3 text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          {invitationLink ? (
            <div className="mt-4 grid gap-2">
              <FieldLabel htmlFor="invitation-link">Einladungslink</FieldLabel>
              <div className="flex gap-2">
                <Input id="invitation-link" className="min-w-0 flex-1" value={invitationLink} readOnly />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(invitationLink)}
                >
                  Kopieren
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
