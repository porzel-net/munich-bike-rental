"use client";

import * as React from "react";
import { Bell, BellRing, LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type PushState = "checking" | "ready" | "active" | "denied" | "unsupported";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function subscriptionJson(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
    throw new Error("Browser-Push-Abonnement ist unvollständig.");
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export function BrowserPushNotifications() {
  const [state, setState] = React.useState<PushState>("checking");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!supported()) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    const permission = Notification.permission;
    if (permission === "denied") {
      queueMicrotask(() => setState("denied"));
      return;
    }
    void getRegistration()
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription || Notification.permission !== "granted") {
          setState("ready");
          return;
        }
        const response = await fetch("/api/admin/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(await subscriptionJson(subscription)),
        });
        if (!response.ok) throw new Error("Push-Abonnement konnte nicht synchronisiert werden.");
        setState("active");
      })
      .catch(() => setState("ready"));
  }, []);

  async function enable() {
    if (!supported()) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        if (permission === "denied") toast.error("Push-Benachrichtigungen wurden im Browser blockiert.");
        return;
      }
      const keyResponse = await fetch("/api/admin/push-subscriptions", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("Browser-Push ist serverseitig nicht eingerichtet.");
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
      if (!publicKey) throw new Error("Öffentlicher Push-Schlüssel fehlt.");
      const registration = await getRegistration();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(publicKey),
        }));
      const response = await fetch("/api/admin/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await subscriptionJson(subscription)),
      });
      if (!response.ok) throw new Error("Browser-Push-Abonnement konnte nicht gespeichert werden.");
      setState("active");
      toast.success("Push-Benachrichtigungen sind aktiviert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push-Benachrichtigungen konnten nicht aktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!supported()) return;
    setBusy(true);
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("ready");
      toast.success("Push-Benachrichtigungen sind deaktiviert.");
    } catch {
      toast.error("Push-Benachrichtigungen konnten nicht deaktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/push-test", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || "Test-Push konnte nicht gesendet werden.");
      toast.success("Test-Push wurde gesendet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test-Push konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;
  const active = state === "active";
  const label = state === "denied" ? "Push im Browser blockiert" : active ? "Push aktiv" : "Push aktivieren";
  return (
    <div className="ml-auto flex items-center gap-2">
      <Button
        type="button"
        variant={active ? "secondary" : "outline"}
        size="sm"
        disabled={busy || state === "checking" || state === "denied"}
        onClick={() => void (active ? disable() : enable())}
        title={state === "denied" ? "Push-Berechtigung in den Browser-Einstellungen freigeben" : label}
        aria-label={label}
      >
        {busy || state === "checking" ? <LoaderCircle className="animate-spin" /> : active ? <BellRing /> : <Bell />}
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {process.env.NODE_ENV === "development" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !active}
          onClick={() => void sendTest()}
          title={active ? "Test-Push an diesen Browser senden" : "Zuerst Push aktivieren"}
          aria-label="Push testen"
        >
          <Send />
          <span className="hidden sm:inline">Push testen</span>
        </Button>
      ) : null}
    </div>
  );
}
