import "server-only";
import { cookies } from "next/headers";

/**
 * Per-user, per-tenant "current project" selection (FORGE-188). A plain UI
 * preference, not a security boundary — every page still re-resolves the
 * project against listVisibleProjects/RLS, so a stale or tampered cookie can
 * only cause a wrong "current project" to be shown, never leak data.
 */
const COOKIE = "fw_current_project";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** "all" means no filter (only meaningful on pages that support it, e.g. Issues). */
export type CurrentProjectValue = string | "all";

async function readMap(): Promise<Record<string, CurrentProjectValue>> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Returns the stored selection for this tenant, or null if never set. */
export async function getCurrentProjectId(tenantId: string): Promise<CurrentProjectValue | null> {
  const map = await readMap();
  return map[tenantId] ?? null;
}

export async function setCurrentProjectId(tenantId: string, value: CurrentProjectValue): Promise<void> {
  const map = await readMap();
  map[tenantId] = value;
  (await cookies()).set(COOKIE, JSON.stringify(map), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}
