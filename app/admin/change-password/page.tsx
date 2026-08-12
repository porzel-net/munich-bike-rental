"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setIsSubmitting(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setIsSubmitting(false);

    if (changeError) {
      setError("Das Passwort konnte nicht geändert werden. Prüfe dein aktuelles Passwort und die Anforderungen.");
      return;
    }

    router.replace("/admin/two-factor");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            Aus Sicherheitsgründen musst du dein initiales Passwort ändern, bevor du die Zwei-Faktor-Authentifizierung
            einrichtest.
          </CardDescription>
        </CardHeader>
        <form onSubmit={changePassword}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Aktuelles Passwort</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Mindestens 14 Zeichen.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Neues Passwort wiederholen</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Wird gespeichert …" : "Passwort speichern"}
            </Button>
            {error ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
