import { NextResponse, type NextRequest } from "next/server";

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function buildContentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      "upgrade-insecure-requests",
    ].join("; ");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline' http: https: ws: wss:`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  const isProduction = process.env.NODE_ENV === "production";

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isProduction) {
    response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
