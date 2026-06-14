import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Read-only, time-boxed impersonation ("support view"). State lives in a SIGNED
 * httpOnly cookie so it can't be forged. We deliberately do NOT grant write
 * access while impersonating (see getTenantContext: role is forced to viewer) —
 * a platform admin silently acting as a tenant is a liability we won't ship yet.
 * Every start/stop is audit-logged by the actions that call set/clear.
 */
const COOKIE = "forge_imp";
const TTL_SECONDS = 30 * 60;

export type Impersonation = { tenantId: string; tenantSlug: string; exp: number; by: string };

function secret(): string {
  return serverEnv().SUPABASE_SERVICE_ROLE_KEY; // server-only; never exposed
}
function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export async function setImpersonationCookie(imp: Impersonation): Promise<void> {
  const payload = Buffer.from(JSON.stringify(imp)).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Validate the signed cookie. Returns null if absent, tampered, or expired. */
export async function readImpersonation(): Promise<Impersonation | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const imp = JSON.parse(Buffer.from(payload, "base64url").toString()) as Impersonation;
    if (typeof imp.exp !== "number" || imp.exp < Date.now()) return null;
    return imp;
  } catch {
    return null;
  }
}
