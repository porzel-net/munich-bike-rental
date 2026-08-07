"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";

type PasskeyPromptProps = {
  userId: string;
};

const dismissedKey = (userId: string) => `mbr-passkey-prompt-dismissed:${userId}`;

export function PasskeyPrompt({ userId }: PasskeyPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPasskeys() {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        setIsLoading(false);
        return;
      }

      try {
        if (window.sessionStorage.getItem(dismissedKey(userId)) === "1") {
          setIsLoading(false);
          return;
        }

        const { data, error: listError } = await authClient.passkey.listUserPasskeys();
        if (!cancelled && !listError && (!data || data.length === 0)) setVisible(true);
      } catch {
        // A missing/blocked WebAuthn implementation should not prevent dashboard use.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPasskeys();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading || !visible) return null;

  async function addPasskey() {
    setIsAdding(true);
    setError(null);
    const { data, error: addError } = await authClient.passkey.addPasskey({ name: "Your Bike Rental" });
    setIsAdding(false);

    if (addError || !data) {
      setError("Der Passkey konnte nicht hinzugefügt werden. Bitte versuche es erneut.");
      return;
    }

    setVisible(false);
  }

  function dismiss() {
    try {
      window.sessionStorage.setItem(dismissedKey(userId), "1");
    } catch {
      // Private browsing modes can disable storage; hiding still works for this render.
    }
    setVisible(false);
  }

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" />
          Mit verifiziertem Passkey schneller anmelden
        </CardTitle>
        <CardDescription>
          Füge einen Passkey hinzu. Für die Anmeldung muss dein Gerät zusätzlich Face ID, Touch ID oder deine Geräte-PIN
          bestätigen.
        </CardDescription>
      </CardHeader>
      {error ? (
        <CardContent>
          <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        </CardContent>
      ) : null}
      <CardFooter className="gap-2">
        <Button type="button" onClick={addPasskey} disabled={isAdding}>
          <KeyRound />
          {isAdding ? "Wird hinzugefügt …" : "Passkey hinzufügen"}
        </Button>
        <Button type="button" variant="ghost" onClick={dismiss} disabled={isAdding}>
          Später
        </Button>
      </CardFooter>
    </Card>
  );
}
