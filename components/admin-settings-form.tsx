"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AdminSettingsForm({ initialWhatsappPhone }: { initialWhatsappPhone: string }) {
  const [whatsappPhone, setWhatsappPhone] = useState(initialWhatsappPhone);
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappPhone }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string; whatsappPhone?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Einstellungen konnten nicht gespeichert werden.");
      setWhatsappPhone(result?.whatsappPhone ?? whatsappPhone.trim());
      toast.success("Einstellungen gespeichert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>WhatsApp</CardTitle>
        <CardDescription>Unter welcher Nummer bist du für das Team per WhatsApp erreichbar?</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="whatsapp-phone">Handynummer</FieldLabel>
            <Input
              id="whatsapp-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+49 170 1234567"
              value={whatsappPhone}
              onChange={(event) => setWhatsappPhone(event.target.value)}
              disabled={saving}
            />
            <FieldDescription>Am besten im internationalen Format, zum Beispiel +49 170 1234567.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </CardFooter>
    </Card>
  );
}
