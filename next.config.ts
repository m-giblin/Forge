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
  // CSP is set dynamically in proxy.ts (src/proxy.ts) with a per-request nonce.
  // Static headers here cannot carry a nonce, so CSP lives in the proxy instead.
  // Prevent browsers from pre-resolving hostnames embedded in page content.
  { key: "X-DNS-Prefetch-Control", value: "off" },
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
      {
        // Session-authenticated internal API routes: same-origin only.
        // CORS is not needed here (browser JS on the same origin doesn't need it),
        // but an explicit deny-cross-origin header prevents confused-deputy attacks
        // from other origins trying to make credentialed requests.
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "" },
          { key: "Vary", value: "Origin" },
        ],
      },
      {
        // Public REST API — allow any origin to call, credentials=omit.
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
