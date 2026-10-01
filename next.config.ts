import type { NextConfig } from "next";

const securityHeaders = [
  // HTTPS enforcement. No `preload` — that requires submission to browser
  // preload lists and is very hard to reverse if ever needed.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Prevent this app from being framed by another origin (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop browsers from MIME-sniffing responses away from their declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (query params, etc.) to cross-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app doesn't use the camera, mic, or geolocation anywhere.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
