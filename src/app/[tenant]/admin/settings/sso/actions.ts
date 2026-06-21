"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: SSO config write bypasses RLS for admin-only settings
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";
import type { SsoConfigPatch } from "@/lib/repositories/ssoConfig";

export async function saveSsoConfigAction(slug: string, patch: SsoConfigPatch): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");

  // Normalise domain: strip @ prefix, lowercase, empty string → null
  if (patch.allowed_domain !== undefined) {
    const d = patch.allowed_domain?.replace(/^@/, "").trim().toLowerCase() || null;
    patch = { ...patch, allowed_domain: d };
  }

  await ssoConfigRepo(createSupabaseServiceClient()).upsert(ctx.tenant.id, patch);
}
