import { createHash } from "node:crypto";

type RateLimitEntry = { count: number; resetAt: number };

const MAX_ENTRIES = 10_000;
const entries = new Map<string, RateLimitEntry>();

/**
 * Small bounded process-local limiter for single-instance public flows. The
 * reverse proxy remains the first line of defense; bounding the map prevents
 * invalid bearer tokens from becoming an unbounded memory allocation.
 */
export function consumeBoundedRateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  for (const [entryKey, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(entryKey);
  }
  if (entries.size >= MAX_ENTRIES && !entries.has(key)) {
    const oldestKey = entries.keys().next().value;
    if (typeof oldestKey === "string") entries.delete(oldestKey);
  }

  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

export function consumePublicOfferRateLimit(
  scope: string,
  token: string,
  options: { max: number; windowMs: number },
  now = Date.now(),
) {
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  return consumeBoundedRateLimit(`public-offer:${scope}:${tokenHash}`, options.max, options.windowMs, now);
}

export function consumeRequestRateLimit(
  request: Request,
  scope: string,
  options: { max: number; windowMs: number },
  now = Date.now(),
) {
  const clientAddress = request.headers.get("x-real-ip")?.trim() || "unknown";
  const clientHash = createHash("sha256").update(clientAddress, "utf8").digest("hex");
  return consumeBoundedRateLimit(`request:${scope}:${clientHash}`, options.max, options.windowMs, now);
}

/**
 * Apply both the per-token limit and a second limit for the client address.
 * The reverse proxy must overwrite X-Real-IP; if it is absent, all callers
 * intentionally share the conservative `unknown` bucket.
 */
export function consumePublicOfferRequestRateLimit(
  request: Request,
  scope: string,
  token: string,
  options: { max: number; windowMs: number },
  now = Date.now(),
) {
  const clientMax = Math.max(options.max * 4, 20);
  if (!consumeRequestRateLimit(request, `public-offer:${scope}`, { max: clientMax, windowMs: options.windowMs }, now)) {
    return false;
  }
  return consumePublicOfferRateLimit(scope, token, options, now);
}

export function resetRateLimitsForTests() {
  entries.clear();
}
