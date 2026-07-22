import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "../../../../lib/auth";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);
const twoFactorVerificationPaths = new Set([
  "/api/auth/two-factor/verify-totp",
  "/api/auth/two-factor/verify-backup-code",
]);

export async function GET(request: Request) {
  return handler.GET(request);
}

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;

  // Account provisioning is handled by the one-time invitation endpoint.
  if (pathname === "/api/auth/admin/create-user") return new Response(null, { status: 404 });

  // Never allow bypassing mandatory TOTP with Better Auth's optional trusted-device feature.
  if (twoFactorVerificationPaths.has(pathname)) {
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    if (body && typeof body === "object" && "trustDevice" in body && body.trustDevice === true) {
      return Response.json({ message: "Trusted devices are disabled." }, { status: 400 });
    }
  }

  return handler.POST(request);
}
