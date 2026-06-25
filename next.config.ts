import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent the app from being embedded in an iframe — blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing responses away from the declared content-type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (no path/query) in the Referer header to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable geolocation, camera, mic, etc. by default — we don't need them.
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
  // Enforce HTTPS for 1 year and include subdomains.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Basic CSP: same-origin scripts, styles, images; allow Supabase and our own API.
  // Intentionally permissive on img-src (data: URIs used in exports).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts (nonces not yet wired; tighten after adding nonce support)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      // Supabase realtime + auth + storage
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. A stray lockfile in a parent dir
  // (e.g. ~/package-lock.json) otherwise makes Turbopack guess the wrong root.
  turbopack: {
    root: __dirname,
  },
  // Allow accessing the dev server over the LAN (e.g. by IP or from a phone).
  // Next 16 blocks server actions + HMR from origins not listed here, which
  // makes things like the join "Create account" button silently do nothing.
  allowedDevOrigins: ["192.168.1.168", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
