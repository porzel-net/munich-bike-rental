/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const allowedDevOrigins = ["localhost", "127.0.0.1", ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",")]
  .map((origin) => origin.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Apple Pay in Stripe Checkout uses the Payment Request API. Do not disable
  // the `payment` feature here; the other sensitive browser features remain
  // disabled explicitly.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

if (isProduction) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const noImageIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, noimageindex, nofollow" }];

const nextConfig = {
  // A separate build directory makes local production-build verification safe
  // while a developer's next dev process is using .next/dev.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  allowedDevOrigins,
  serverExternalPackages: ["@whiskeysockets/baileys"],
  images: {
    formats: ["image/avif", "image/webp"],
    imageSizes: [32, 48, 64, 96, 128, 160, 192, 256, 320, 384],
    qualities: [72, 75],
  },
  output: "standalone",
  // Never copy local data, secrets, tests, or VCS metadata into standalone
  // output, even when a dynamic filesystem call broadens NFT tracing.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./tests/**/*", "./.env*", "./.git/**/*", "./coverage/**/*"],
  },
  compress: true,
  poweredByHeader: false,
  // Better Auth and the database are initialized while Next collects route
  // data. One build worker prevents concurrent SQLite migration races.
  experimental: { cpus: 1 },
  async headers() {
    if (!isProduction) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/assets/:path*",
        headers: noImageIndexHeaders,
      },
      {
        source: "/bikes/:path*",
        headers: noImageIndexHeaders,
      },
      {
        source: "/opengraph-image",
        headers: noImageIndexHeaders,
      },
      {
        source: "/google-maps-lindau.png",
        headers: noImageIndexHeaders,
      },
      {
        source: "/maps-friedrichshafen.png",
        headers: noImageIndexHeaders,
      },
      {
        source: "/maps-konstanz.png",
        headers: noImageIndexHeaders,
      },
      {
        source: "/angebot/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
        ],
      },
      {
        source: "/assets/img/about/:path*",
        headers: noImageIndexHeaders,
      },
    ];
  },
};

export default nextConfig;
