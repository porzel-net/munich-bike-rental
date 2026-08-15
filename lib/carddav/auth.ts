import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 20;

type ScryptHash = {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  digest: Buffer;
};

function assertPassword(password: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 256) {
    throw new Error("CardDAV-Passwörter müssen zwischen 20 und 256 Zeichen lang sein.");
  }
}

async function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: SCRYPT_MAXMEM }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export function generateCarddavPassword() {
  return randomBytes(24).toString("base64url");
}

export async function hashCarddavPassword(password: string) {
  assertPassword(password);
  const salt = randomBytes(16);
  const digest = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return ["scrypt-v1", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), digest.toString("base64url")].join(
    "$",
  );
}

function parseHash(value: string): ScryptHash | null {
  const [version, nValue, rValue, pValue, saltValue, digestValue] = value.split("$");
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (
    version !== "scrypt-v1" ||
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 16_384 ||
    n > 131_072 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 8 ||
    !saltValue ||
    !digestValue
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const digest = Buffer.from(digestValue, "base64url");
    if (salt.length < 16 || digest.length !== KEY_LENGTH) return null;
    return { n, r, p, salt, digest };
  } catch {
    return null;
  }
}

export async function verifyCarddavPassword(password: string, storedHash: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 256) return false;
  const parsed = parseHash(storedHash);
  if (!parsed) return false;
  const digest = await derive(password, parsed.salt, parsed.n, parsed.r, parsed.p);
  return digest.length === parsed.digest.length && timingSafeEqual(digest, parsed.digest);
}

export function parseBasicAuthorization(value: string | null) {
  if (!value) return null;
  const match = /^Basic\s+([^\s]+)$/i.exec(value.trim());
  if (!match) return null;

  try {
    const encoded = match[1];
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) return null;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    if (username.length > 128 || password.length > 256 || /[\r\n]/.test(decoded)) return null;
    return { username, password };
  } catch {
    return null;
  }
}

export const carddavPasswordPolicy = {
  minLength: MIN_PASSWORD_LENGTH,
};
