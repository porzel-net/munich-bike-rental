import { timingSafeEqual } from "node:crypto";

/**
 * Validates a deployment-only bearer token without leaking its length or
 * comparing it with a normal string equality check.
 *
 * Internal jobs are intentionally fail-closed when a token is missing or too
 * short. Generate at least 32 random bytes for every deployment.
 */
export function hasValidInternalBearerToken(request: Request, environment: Partial<NodeJS.ProcessEnv>, name: string) {
  const expected = environment[name]?.trim();
  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!expected || expected.length < 32 || !authorization?.startsWith(prefix)) return false;

  const supplied = authorization.slice(prefix.length);
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
