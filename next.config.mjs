/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const allowedDevOrigins = ["localhost", "127.0.0.1", ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",")]
  .map((origin) => origin.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

if (isProduction) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
}

const noImageIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, noimageindex, nofollow" }];

const nextConfig = {
  allowedDevOrigins,
  images: {
    formats: ["image/avif", "image/webp"],
    imageSizes: [32, 48, 64, 96, 128, 160, 192, 256, 320, 384],
    qualities: [72, 75],
  },
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  async headers() {
    if (!isProduction) {
      return [];
    }

    return [
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
        source: "/favicon.png",
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
    ];
  },
};

export default nextConfig;
