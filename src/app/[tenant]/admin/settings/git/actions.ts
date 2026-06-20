"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: git admin writes (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";

async function adminCtx(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  return ctx;
}

export async function connectGitHubAction(slug: string): Promise<{ secret: string }> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  const repo = gitIntegrationRepo(svc);

  // Revoke any existing connection first
  const existing = await repo.getConnection(ctx.tenant.id);
  if (existing) await repo.revokeConnection(ctx.tenant.id, existing.id);

  // Generate a random webhook secret
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  await repo.createConnection(ctx.tenant.id, secret);
  revalidatePath(`/${slug}/admin/settings/git`);
  return { secret };
}

export async function disconnectGitHubAction(slug: string): Promise<void> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  const repo = gitIntegrationRepo(svc);
  const conn = await repo.getConnection(ctx.tenant.id);
  if (conn) await repo.revokeConnection(ctx.tenant.id, conn.id);
  revalidatePath(`/${slug}/admin/settings/git`);
}

export async function addRepoLinkAction(slug: string, repoFullName: string, projectId: string): Promise<void> {
  const ctx = await adminCtx(slug);
  if (!repoFullName.includes("/")) throw new Error("Repo must be in owner/repo format");
  const svc = createSupabaseServiceClient();
  const repo = gitIntegrationRepo(svc);
  const conn = await repo.getConnection(ctx.tenant.id);
  if (!conn) throw new Error("No active GitHub connection");
  await repo.addRepoLink(ctx.tenant.id, conn.id, repoFullName.trim(), projectId || null);
  revalidatePath(`/${slug}/admin/settings/git`);
}

export async function removeRepoLinkAction(slug: string, linkId: string): Promise<void> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  await gitIntegrationRepo(svc).removeRepoLink(ctx.tenant.id, linkId);
  revalidatePath(`/${slug}/admin/settings/git`);
}
