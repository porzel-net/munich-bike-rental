"use client";

import { type FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";

function failureMessage() {
  return "Der Code konnte nicht bestätigt werden. Bitte erneut versuchen.";
}

export default function TwoFactorPage() {
  const { data: session, isPending } = authClient.useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrollmentRequired = Boolean(session?.user && !session.user.twoFactorEnabled);

  useEffect(() => {
    if (session?.user.twoFactorEnabled) {
      window.location.assign("/admin/bookings");
    }
  }, [session?.user.twoFactorEnabled]);

  useEffect(() => {
    if (!totpURI) return;

    let cancelled = false;
    void QRCode.toDataURL(totpURI, { errorCorrectionLevel: "M", margin: 1, width: 256 }).then((dataURL) => {
      if (!cancelled) setQrCode(dataURL);
    });

    return () => {
      cancelled = true;
    };
  }, [totpURI]);

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password });
    setIsSubmitting(false);

    if (enableError || !data) {
      setError("Die TOTP-Einrichtung konnte nicht gestartet werden.");
      return;
    }

    setTotpURI(data.totpURI);
    setBackupCodes(data.backupCodes);
    setPassword("");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const { error: verificationError } = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
    setIsSubmitting(false);

    if (verificationError) {
      setError(failureMessage());
      return;
    }

    window.location.assign("/admin/bookings");
  }

  if (isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
        <p className="text-muted-foreground">Sitzung wird geprüft …</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-2 px-8 pt-8">
          <CardTitle className="text-xl tracking-tight">
            {enrollmentRequired ? "Authenticator-App einrichten" : "TOTP-Code bestätigen"}
          </CardTitle>
          <CardDescription className="leading-6">
            {enrollmentRequired
              ? "Richte jetzt die verpflichtende Zwei-Faktor-Authentifizierung für dein Administratorkonto ein."
              : "Öffne deine Authenticator-App und gib den aktuellen sechsstelligen Code ein."}
          </CardDescription>
        </CardHeader>

        {enrollmentRequired && !totpURI ? (
          <form onSubmit={beginEnrollment}>
            <CardContent className="px-8 pb-8">
              <FieldGroup>
                <FieldDescription>
                  Bestätige dein aktuelles Passwort. Danach wird ein TOTP-Schlüssel für deine Authenticator-App erzeugt.
                </FieldDescription>
                <Field>
                  <FieldLabel htmlFor="two-factor-password">Aktuelles Passwort</FieldLabel>
                  <Input
                    id="two-factor-password"
                    autoComplete="current-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="px-8 pb-8 pt-0">
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Wird eingerichtet …" : "TOTP einrichten"}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <CardContent className="px-8 pb-8">
              {totpURI ? (
                <FieldGroup>
                  <FieldDescription className="leading-6">
                    Scanne den QR-Code mit deiner Authenticator-App und gib anschließend den sechsstelligen Code ein.
                  </FieldDescription>
                  {qrCode ? (
                    <div className="flex justify-center rounded-3xl border bg-muted/30 p-5">
                      <img
                        className="size-56 rounded-2xl border bg-background p-2"
                        src={qrCode}
                        alt="TOTP-Einrichtungscode für die Authenticator-App"
                      />
                    </div>
                  ) : null}
                  <code className="block rounded-2xl border bg-muted p-4 text-xs break-all">{totpURI}</code>
                  <div className="rounded-3xl border bg-muted/40 p-4">
                    <p className="mb-3 text-sm font-medium">Notfallcodes einmalig sicher offline ablegen</p>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm">
                      {backupCodes.map((backupCode) => (
                        <li key={backupCode}>{backupCode}</li>
                      ))}
                    </ul>
                  </div>
                </FieldGroup>
              ) : null}
              <Field className={totpURI ? "mt-8" : "gap-3"}>
                <FieldLabel className="block w-full text-center text-sm" htmlFor="two-factor-code">
                  TOTP-Code
                </FieldLabel>
                <div className="flex justify-center">
                  <InputOTP
                    id="two-factor-code"
                    aria-label="Sechsstelliger TOTP-Code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    value={code}
                    onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                    required
                  >
                    <InputOTPGroup>
                      <InputOTPSlot className="size-11 text-lg" index={0} />
                      <InputOTPSlot className="size-11 text-lg" index={1} />
                      <InputOTPSlot className="size-11 text-lg" index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator className="mx-3" />
                    <InputOTPGroup>
                      <InputOTPSlot className="size-11 text-lg" index={3} />
                      <InputOTPSlot className="size-11 text-lg" index={4} />
                      <InputOTPSlot className="size-11 text-lg" index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </Field>
            </CardContent>
            <CardFooter className="px-8 pb-8 pt-0">
              <Button className="w-full" type="submit" disabled={isSubmitting || code.length !== 6}>
                {isSubmitting ? "Wird geprüft …" : "Code bestätigen"}
              </Button>
            </CardFooter>
          </form>
        )}
        {error ? (
          <CardFooter className="border-t-0 px-8 pb-8 pt-0">
            <p
              className="w-full rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
