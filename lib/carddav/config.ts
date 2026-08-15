import { createHash } from "node:crypto";

function trimUrl(value: string) {
  return value.replace(/\/+$/, "");
}

const DEFAULT_INTERNAL_HOSTS = new Set(["radicale", "localhost", "127.0.0.1", "::1", "[::1]"]);

function trustedInternalHosts(environment: Partial<NodeJS.ProcessEnv>) {
  const configured = environment.CARDDAV_INTERNAL_ALLOWED_HOSTS?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_INTERNAL_HOSTS);
}

export function getCarddavPublicUrl(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = environment.CARDDAV_PUBLIC_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && environment.NODE_ENV === "production") return null;
    return trimUrl(url.toString());
  } catch {
    return null;
  }
}

export function getCarddavInternalUrl(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = environment.CARDDAV_INTERNAL_URL?.trim() || "http://radicale:5232";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (!trustedInternalHosts(environment).has(url.hostname.toLowerCase())) return null;
    return trimUrl(url.toString());
  } catch {
    return null;
  }
}

/** Stable, non-PII Radicale username derived from the Better Auth user id. */
export function carddavUsername(userId: string) {
  return `mbr-${createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 24)}`;
}

export function carddavCollectionUrl(username: string, environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const base = getCarddavInternalUrl(environment);
  if (!base) return null;
  return `${base}/${encodeURIComponent(username)}/contacts/`;
}

export function carddavPublicCollectionUrl(username: string, environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const base = getCarddavPublicUrl(environment);
  if (!base) return null;
  return `${base}/${encodeURIComponent(username)}/contacts/`;
}
