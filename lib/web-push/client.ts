import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createSign,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const P256_PUBLIC_KEY_BYTES = 65;
const P256_PRIVATE_KEY_BYTES = 32;
const AUTH_SECRET_BYTES = 16;
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

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="), "base64");
}

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function configuredKeys() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || process.env.APP_ORIGIN?.trim();
  if (!publicKey || !privateKey || !subject) return null;

  const publicKeyBytes = decodeBase64Url(publicKey);
  const privateKeyBytes = decodeBase64Url(privateKey);
  if (publicKeyBytes.length !== P256_PUBLIC_KEY_BYTES || privateKeyBytes.length !== P256_PRIVATE_KEY_BYTES) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY oder WEB_PUSH_VAPID_PRIVATE_KEY hat eine ungültige Länge");
  }
  if (!/^mailto:|^https?:\/\//u.test(subject)) {
    throw new Error("WEB_PUSH_VAPID_SUBJECT muss eine mailto:- oder HTTPS/HTTP-URL sein");
  }

  const derivedPublicKey = createECDH("prime256v1");
  derivedPublicKey.setPrivateKey(privateKeyBytes);
  if (!derivedPublicKey.getPublicKey().equals(publicKeyBytes)) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY passt nicht zum privaten Schlüssel");
  }

  return { publicKey, publicKeyBytes, privateKeyBytes, subject };
}

export function isWebPushConfigured() {
  return Boolean(configuredKeys());
}

export function getWebPushPublicKey() {
  return configuredKeys()?.publicKey ?? null;
}

function vapidPrivateKey(config: NonNullable<ReturnType<typeof configuredKeys>>) {
  return createPrivateKey({
    key: {
      crv: "P-256",
      d: encodeBase64Url(config.privateKeyBytes),
      kty: "EC",
      x: encodeBase64Url(config.publicKeyBytes.subarray(1, 33)),
      y: encodeBase64Url(config.publicKeyBytes.subarray(33, 65)),
    },
    format: "jwk",
  });
}

function createVapidToken(endpoint: string, config: NonNullable<ReturnType<typeof configuredKeys>>) {
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const payload = encodeBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1_000) + 12 * 60 * 60,
        sub: config.subject,
      }),
    ),
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign({ key: vapidPrivateKey(config), dsaEncoding: "ieee-p1363" });
  return `${unsignedToken}.${encodeBase64Url(signature)}`;
}

function hkdf(key: Buffer, salt: Buffer, info: Buffer, length: number) {
  return Buffer.from(hkdfSync("sha256", key, salt, info, length));
}

function hkdfExtract(salt: Buffer, inputKeyMaterial: Buffer) {
  return createHmac("sha256", salt).update(inputKeyMaterial).digest();
}

function encryptPayload(subscription: WebPushSubscriptionData, payload: string) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== P256_PUBLIC_KEY_BYTES || authSecret.length !== AUTH_SECRET_BYTES) {
    throw new Error("Browser-Push-Abonnement enthält ungültige Schlüssel");
  }

  const server = createECDH("prime256v1");
  const serverPublicKey = server.generateKeys();
  const sharedSecret = server.computeSecret(clientPublicKey);
  const authInfo = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublicKey, serverPublicKey]);
  const ikm = hkdf(sharedSecret, authSecret, authInfo, 32);
  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const contentEncryptionKey = hkdf(prk, Buffer.alloc(0), Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(prk, Buffer.alloc(0), Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublicKey.length]), serverPublicKey, ciphertext]);
}

export async function sendWebPushNotification(subscription: WebPushSubscriptionData, payload: string) {
  const config = configuredKeys();
  if (!config) throw new Error("Web-Push ist nicht konfiguriert");
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${createVapidToken(subscription.endpoint, config)}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(MAX_RETRY_AFTER_SECONDS),
    },
    body: encryptPayload(subscription, payload),
  });
  if (response.status === 404 || response.status === 410) throw new WebPushEndpointGoneError();
  if (!response.ok) throw new Error(`Web-Push-Anbieter antwortete mit HTTP ${response.status}`);
}
