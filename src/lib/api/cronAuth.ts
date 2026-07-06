import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for cron and webhook secrets.
 * Pads both sides to the same length before comparing to avoid length oracles.
 */
export function verifyCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const expected = `Bearer ${cronSecret}`;
  const actual = authHeader ?? "";
  const len = Math.max(actual.length, expected.length, 32);
  const bufActual = Buffer.alloc(len);
  const bufExpected = Buffer.alloc(len);
  bufActual.write(actual);
  bufExpected.write(expected);
  return timingSafeEqual(bufActual, bufExpected);
}
