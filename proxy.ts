import { NextResponse, type NextRequest } from "next/server";
import mainImage from "./main.png";

const noImageIndexValue = "noindex, noimageindex, nofollow";

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function buildContentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === "production" && process.env.STARTUP_CHECKS_MODE !== "browser-test";

  if (isProduction) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: https://www.google-analytics.com https://*.google-analytics.com https://stats.g.doubleclick.net https://www.google.de",
      "font-src 'self'",
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net",
      `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline'",
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
  const isProduction = process.env.NODE_ENV === "production" && process.env.STARTUP_CHECKS_MODE !== "browser-test";

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isProduction) {
    response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));

    const pathname = request.nextUrl.pathname;
    const isStaticMedia = pathname.startsWith("/_next/static/media/");
    const isOptimizedImage = pathname === "/_next/image";
    const isHeroImage = pathname === mainImage.src || request.nextUrl.searchParams.get("url") === mainImage.src;

    if ((isStaticMedia || isOptimizedImage) && !isHeroImage) {
      response.headers.set("X-Robots-Tag", noImageIndexValue);
    }
  }

  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  if (request.nextUrl.pathname === "/angebot" || request.nextUrl.pathname.startsWith("/angebot/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/_next/image",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/_next/static/media/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
