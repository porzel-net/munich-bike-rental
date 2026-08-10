import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "../../../../lib/auth";
import { readBoundedBytes, readBoundedJson } from "../../../../lib/security/request-body";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);
const twoFactorVerificationPaths = new Set([
  "/api/auth/two-factor/verify-totp",
  "/api/auth/two-factor/verify-backup-code",
]);
const MAX_AUTH_BODY_BYTES = 256 * 1024;

function isDisabledAdminPath(pathname: string) {
  return pathname === "/api/auth/admin" || pathname.startsWith("/api/auth/admin/");
}

export async function GET(request: Request) {
  if (isDisabledAdminPath(new URL(request.url).pathname)) return new Response(null, { status: 404 });
  return handler.GET(request);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
    return Response.json({ message: "Request body too large." }, { status: 413 });
  }
  if (request.body && (await readBoundedBytes(request.clone(), MAX_AUTH_BODY_BYTES)) === null) {
    return Response.json({ message: "Request body too large." }, { status: 413 });
  }
  const pathname = new URL(request.url).pathname;

  if (isDisabledAdminPath(pathname)) return new Response(null, { status: 404 });

  // Account provisioning is handled by the one-time invitation endpoint.
  if (pathname === "/api/auth/admin/create-user") return new Response(null, { status: 404 });

  // Never allow bypassing mandatory TOTP with Better Auth's optional trusted-device feature.
  if (twoFactorVerificationPaths.has(pathname)) {
    const body = await readBoundedJson(request.clone(), MAX_AUTH_BODY_BYTES);
    if (body && typeof body === "object" && "trustDevice" in body && body.trustDevice === true) {
      return Response.json({ message: "Trusted devices are disabled." }, { status: 400 });
    }
  }

  return handler.POST(request);
}
