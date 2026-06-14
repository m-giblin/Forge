import type { NextConfig } from "next";

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
};

export default nextConfig;
