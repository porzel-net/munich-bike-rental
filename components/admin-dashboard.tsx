"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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
      setMessage("Der Einladungslink konnte nicht erzeugt werden.");
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
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
            Geschützter Bereich
          </p>
          <h1 className="font-[Poppins] text-4xl font-black uppercase">Willkommen, {userName}</h1>
        </div>
        <button className="rounded-lg border border-black/15 px-4 py-2 font-semibold" type="button" onClick={signOut}>
          Abmelden
        </button>
      </div>
      <section className="max-w-xl rounded-2xl border border-black/10 bg-white p-8 shadow-xl">
        <h2 className="mb-2 font-[Poppins] text-2xl font-black uppercase">Einladung erzeugen</h2>
        <p className="mb-6 text-sm leading-6 text-[var(--text-muted)]">
          Nur Admins können Einladungen erzeugen. Der Empfänger legt sein Passwort selbst fest und richtet danach die
          verpflichtende Authenticator-App ein.
        </p>
        <form className="grid gap-4" onSubmit={createInvitation}>
          <label className="grid gap-1 text-sm font-semibold">
            Name
            <input
              className="rounded-lg border border-black/15 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Rolle
            <select
              className="rounded-lg border border-black/15 px-3 py-2"
              value={role}
              onChange={(event) => setRole(event.target.value as "admin" | "standortuser")}
            >
              <option value="standortuser">Standortuser</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {role === "standortuser" ? (
            <label className="grid gap-1 text-sm font-semibold">
              Zugeordneter Standort
              <select
                className="rounded-lg border border-black/15 px-3 py-2"
                value={locationKey}
                onChange={(event) => setLocationKey(event.target.value)}
              >
                <option value="munich">München</option>
                <option value="regensburg">Regensburg</option>
                <option value="lindau">Lindau Bodensee</option>
                <option value="friedrichshafen">Friedrichshafen</option>
                <option value="konstanz">Konstanz</option>
              </select>
            </label>
          ) : null}
          <button
            className="rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Link wird erzeugt …" : "Einladungslink erzeugen"}
          </button>
        </form>
        {message ? (
          <p className="mt-4 rounded-lg bg-black/[0.04] p-3 text-sm" role="status">
            {message}
          </p>
        ) : null}
        {invitationLink ? (
          <div className="mt-4 grid gap-2">
            <label className="text-sm font-semibold" htmlFor="invitation-link">
              Einladungslink
            </label>
            <div className="flex gap-2">
              <input
                id="invitation-link"
                className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
                value={invitationLink}
                readOnly
              />
              <button
                className="rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold"
                type="button"
                onClick={() => void navigator.clipboard.writeText(invitationLink)}
              >
                Kopieren
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
