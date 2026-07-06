import "server-only";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254", // AWS/Azure/GCP instance metadata
]);

// [lo, hi] inclusive, as 32-bit unsigned ints
const RFC1918_RANGES: [number, number][] = [
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8  (loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local + metadata)
];

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0;
}

function isPrivateIp(host: string): boolean {
  const n = ipv4ToInt(host);
  if (n === null) return false;
  return RFC1918_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

/**
 * Validates a tenant-supplied URL before making an outbound request.
 * - Requires HTTPS scheme
 * - Blocks loopback, RFC-1918 private ranges, link-local, and metadata endpoints
 */
export function validateWebhookUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Webhook URL must use HTTPS" };
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Webhook URL targets a blocked host" };
  }
  if (isPrivateIp(host)) {
    return { ok: false, reason: "Webhook URL targets a private or loopback address" };
  }

  return { ok: true };
}
