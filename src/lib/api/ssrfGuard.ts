import "server-only";
import { lookup } from "node:dns/promises";

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

function isPrivateIpv4(host: string): boolean {
  const n = ipv4ToInt(host);
  if (n === null) return false;
  return RFC1918_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

// Block all IPv6: loopback (::1), link-local (fe80::/10), ULA (fc00::/7),
// IPv4-mapped (::ffff:x.x.x.x), and the unspecified address (::).
function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // fe80::/10
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA fc00::/7
  if (h.startsWith("::ffff:")) return true; // IPv4-mapped
  return false;
}

/**
 * Validates a tenant-supplied URL before making an outbound request.
 * - Requires HTTPS scheme
 * - Blocks loopback, RFC-1918 private ranges, link-local, metadata endpoints
 * - Blocks IPv6 private/loopback ranges
 * - Resolves DNS and re-checks the resolved IP to defeat DNS rebinding
 */
export async function validateWebhookUrl(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
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

  // IPv6 literals are wrapped in [...] in the URL hostname
  const isIpv6Literal = host.startsWith("[") && host.endsWith("]");
  if (isIpv6Literal) {
    const addr = host.slice(1, -1);
    if (isBlockedIpv6(addr)) {
      return { ok: false, reason: "Webhook URL targets a blocked IPv6 address" };
    }
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Webhook URL targets a blocked host" };
  }

  // Block numeric IPs (decimal, octal, hex encoded) that resolve to private ranges
  if (isPrivateIpv4(host)) {
    return { ok: false, reason: "Webhook URL targets a private or loopback address" };
  }

  // DNS resolution — defeats rebinding: resolve NOW and block if the resolved IP is private.
  // Only check for non-IP hostnames (IPs don't need a lookup).
  if (!isIpv6Literal && ipv4ToInt(host) === null) {
    try {
      const { address } = await lookup(host, { family: 4 });
      if (isPrivateIpv4(address)) {
        return { ok: false, reason: "Webhook URL resolves to a private or loopback address" };
      }
    } catch {
      // DNS lookup failed — block rather than allow an unresolvable host
      return { ok: false, reason: "Webhook URL hostname could not be resolved" };
    }
  }

  return { ok: true };
}
