"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Invitation = {
  name: string | null;
  role: "admin" | "standortuser";
  locationLabel: string | null;
};

export function SignupForm({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [signupName, setSignupName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/auth/invitations/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid");
        return (await response.json()) as Invitation;
      })
      .then((data) => {
        if (!cancelled) setInvitation(data);
      })
      .catch(() => {
        if (!cancelled) setError("Dieser Einladungslink ist ungültig oder abgelaufen.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation || password !== confirmation) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/auth/invitations/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: invitation.name ? undefined : signupName }),
    });
    if (!response.ok) {
      setIsSubmitting(false);
      setError("Das Konto konnte nicht erstellt werden. Der Link ist möglicherweise bereits verwendet.");
      return;
    }

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/admin/two-factor",
      rememberMe: false,
    });
    setIsSubmitting(false);
    if (signInError) {
      setError("Konto erstellt. Bitte öffne danach /admin/login und melde dich an.");
      return;
    }
    router.replace("/admin/two-factor");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konto einrichten</CardTitle>
        <CardDescription>
          Diese Einladung ist nur einmal gültig. Name und Berechtigungen sind festgelegt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Einladung wird geprüft …</p> : null}
        {!isLoading && invitation ? (
          <form id="signup-form" className="grid gap-6" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signup-name">Name</FieldLabel>
                <Input
                  id="signup-name"
                  value={invitation.name ?? signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  readOnly={Boolean(invitation.name)}
                  aria-readonly={Boolean(invitation.name)}
                  required
                />
                <FieldDescription className="text-xs">
                  {invitation.name
                    ? "Der Name wird vom einladenden Admin vorgegeben."
                    : "Wähle deinen Namen für das Konto."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-role">Berechtigung</FieldLabel>
                <Input
                  id="signup-role"
                  value={
                    invitation.role === "admin" ? "Admin" : `Standortuser · ${invitation.locationLabel ?? "Standort"}`
                  }
                  readOnly
                  aria-readonly="true"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-email">E-Mail-Adresse</FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-password">Passwort</FieldLabel>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={16}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <FieldDescription className="text-xs">
                  Mindestens 16 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-confirm-password">Passwort bestätigen</FieldLabel>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
            {error ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
        {!isLoading && !invitation && error ? (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
      {!isLoading && invitation ? (
        <CardFooter>
          <Button className="w-full" type="submit" form="signup-form" disabled={isSubmitting}>
            {isSubmitting ? "Konto wird erstellt …" : "Konto erstellen"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
