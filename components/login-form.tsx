"use client";

import { type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Read from the form itself so browser/password-manager autofill is included
    // even when it did not trigger React's controlled-input change event.
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const submittedPassword = String(formData.get("password") ?? "");

    if (!submittedEmail || !submittedPassword) {
      setIsSubmitting(false);
      setError("Bitte gib E-Mail-Adresse und Passwort ein.");
      return;
    }

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: submittedEmail,
        password: submittedPassword,
        callbackURL: "/admin/bookings",
        rememberMe: false,
      });

      if (signInError) {
        setError("Anmeldung nicht möglich. Prüfe deine Zugangsdaten oder versuche es später erneut.");
        return;
      }

      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        window.location.assign("/admin/two-factor");
        return;
      }

      if (data) {
        window.location.assign("/admin/bookings");
        return;
      }

      setError("Anmeldung nicht möglich. Bitte versuche es erneut.");
    } catch {
      setError("Anmeldung nicht möglich. Prüfe deine Verbindung und versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onPasskeySignIn() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: passkeyError } = await authClient.signIn.passkey({ autoFill: false });

      if (passkeyError || !data) {
        setError("Passkey-Anmeldung nicht möglich. Bitte entsperre deinen Passkey und versuche es erneut.");
        return;
      }

      window.location.assign("/admin/bookings");
    } catch {
      setError("Passkey-Anmeldung nicht möglich. Bitte entsperre deinen Passkey und versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Willkommen zurück</CardTitle>
        <CardDescription>Gib deine Zugangsdaten ein, um den Adminbereich zu öffnen.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
              <Input
                id="email"
                name="email"
                autoComplete="username webauthn"
                type="email"
                placeholder="name@beispiel.de"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Passwort</FieldLabel>
              <Input
                id="password"
                name="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Wird angemeldet …" : "Anmelden"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <div className="relative w-full text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-card px-2">oder</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        </div>
        <Button className="w-full" type="button" variant="outline" onClick={onPasskeySignIn} disabled={isSubmitting}>
          <KeyRound />
          Mit verifiziertem Passkey anmelden
        </Button>
      </CardFooter>
    </Card>
  );
}
