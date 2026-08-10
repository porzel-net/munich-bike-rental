/**
 * Returns the exact origin configured for browser requests.
 *
 * Invalid configuration fails closed instead of turning an origin check into
 * a 500 response or, worse, accepting an attacker-controlled origin.
 */
export function configuredOrigin(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const configured = environment.BETTER_AUTH_URL?.trim() || environment.APP_ORIGIN?.trim() || "http://localhost:3000";
  try {
    const origin = new URL(configured);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return null;
    return origin.origin;
  } catch {
    return null;
  }
}

export function hasTrustedOrigin(request: Request, environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const origin = request.headers.get("origin");
  const expected = configuredOrigin(environment);
  return Boolean(origin && expected && origin === expected);
}
