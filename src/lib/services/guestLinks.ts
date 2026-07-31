import "server-only";
import { createHash, randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- resolving a guest token has no session; must bypass RLS by design (see migration 0115)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { guestLinksRepo, type ProjectGuestLink } from "@/lib/repositories/guestLinks";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function getGuestLink(tenantId: string, projectId: string): Promise<ProjectGuestLink | null> {
  const supabase = await createSupabaseServerClient();
  return guestLinksRepo(supabase).get(tenantId, projectId);
}

export async function listGuestLinks(tenantId: string): Promise<ProjectGuestLink[]> {
  const supabase = await createSupabaseServerClient();
  return guestLinksRepo(supabase).listForTenant(tenantId);
}

/** (Re)generates the link — returns the raw token once; only its hash is ever stored. */
export async function generateGuestLink(tenantId: string, projectId: string, createdBy: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const rawToken = randomBytes(32).toString("hex");
  await guestLinksRepo(supabase).upsert(tenantId, projectId, hashToken(rawToken), createdBy);
  return rawToken;
}

export async function revokeGuestLink(tenantId: string, projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await guestLinksRepo(supabase).revoke(tenantId, projectId);
}

/** Public, unauthenticated resolution path — service-role, scoped entirely by the token itself. */
export async function resolveGuestLink(rawToken: string): Promise<ProjectGuestLink | null> {
  if (!rawToken) return null;
  const svc = createSupabaseServiceClient();
  return guestLinksRepo(svc).resolveByTokenHash(hashToken(rawToken));
}
