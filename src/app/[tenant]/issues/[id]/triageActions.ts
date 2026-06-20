"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: triage accept writes priority/category (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { triageIssue, clearTriage } from "@/lib/services/triage";
import { issuesRepo } from "@/lib/repositories/issues";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

export async function runTriageAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  await triageIssue(ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function acceptTriageAction(
  slug: string,
  issueId: string,
  fields: { priority?: string; categoryLabel?: string | null },
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");

  const svc = createSupabaseServiceClient();
  const patch: Record<string, unknown> = {};

  if (fields.priority) patch.priority = fields.priority;

  if (fields.categoryLabel) {
    const cats = await fieldConfigRepo(svc).listCategories(ctx.tenant.id);
    const cat = cats.find((c) => c.name === fields.categoryLabel);
    if (cat) patch.category_id = cat.id;
  }

  patch.triage_suggestion = null; // dismiss after accepting

  await issuesRepo(svc).update(ctx.tenant.id, issueId, patch as Parameters<ReturnType<typeof issuesRepo>["update"]>[2]);
  revalidatePath(`/${slug}/issues/${issueId}`);
  revalidatePath(`/${slug}/board`);
}

export async function dismissTriageAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  await clearTriage(ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}
