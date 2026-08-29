import { createECDH } from "node:crypto";

import webPush from "web-push";

import { isAllowedWebPushEndpoint } from "./endpoint";

const MAX_RETRY_AFTER_SECONDS = 60 * 60;

export type WebPushSubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export class WebPushEndpointGoneError extends Error {
  constructor() {
    super("Web-Push-Endpunkt ist nicht mehr registriert.");
    this.name = "WebPushEndpointGoneError";
  }
}

export class WebPushEndpointRejectedError extends Error {
  constructor() {
    super("Web-Push-Endpunkt ist kein erlaubter Push-Service.");
    this.name = "WebPushEndpointRejectedError";
  }
}

type VapidKeyMaterial = { publicKey: string; privateKey: string; subject: string };

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="), "base64");
}

function keyMaterial() {
  const envPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const envPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const envSubject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const hasEnvKey = Boolean(envPublicKey || envPrivateKey);
  if (hasEnvKey && (!envPublicKey || !envPrivateKey)) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY und WEB_PUSH_VAPID_PRIVATE_KEY müssen gemeinsam gesetzt sein");
  }
  if (envPublicKey && envPrivateKey) {
    return {
      publicKey: envPublicKey,
      privateKey: envPrivateKey,
      subject: envSubject || process.env.APP_ORIGIN?.trim() || "",
    } satisfies VapidKeyMaterial;
  }
  return null;
}

function configuredKeys() {
  const material = keyMaterial();
  if (!material) return null;

  const publicKeyBytes = decodeBase64Url(material.publicKey);
  const privateKeyBytes = decodeBase64Url(material.privateKey);
  if (publicKeyBytes.length !== 65 || privateKeyBytes.length !== 32) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY oder WEB_PUSH_VAPID_PRIVATE_KEY hat eine ungültige Länge");
  }
  if (!/^mailto:|^https?:\/\//u.test(material.subject)) {
    throw new Error("WEB_PUSH_VAPID_SUBJECT muss eine mailto:- oder HTTPS/HTTP-URL sein");
  }

  const derivedPublicKey = createECDH("prime256v1");
  derivedPublicKey.setPrivateKey(privateKeyBytes);
  if (!derivedPublicKey.getPublicKey().equals(publicKeyBytes)) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY passt nicht zum privaten Schlüssel");
  }
  return material;
}

export function isWebPushConfigured() {
  return Boolean(configuredKeys());
}

export function getWebPushPublicKey() {
  return configuredKeys()?.publicKey ?? null;
}

export async function sendWebPushNotification(subscription: WebPushSubscriptionData, payload: string) {
  if (!isAllowedWebPushEndpoint(subscription.endpoint)) throw new WebPushEndpointRejectedError();
  const config = configuredKeys();
  if (!config) throw new Error("Web-Push ist nicht konfiguriert");

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      payload,
      {
        TTL: MAX_RETRY_AFTER_SECONDS,
        contentEncoding: "aes128gcm",
        urgency: "high",
        vapidDetails: config,
      },
    );
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    if (statusCode === 404 || statusCode === 410) throw new WebPushEndpointGoneError();
    const message = error instanceof Error ? error.message : "Unbekannter Versandfehler";
    throw new Error(`Web-Push-Anbieter antwortete${statusCode ? ` mit HTTP ${statusCode}` : ""}: ${message}`);
  }
}
