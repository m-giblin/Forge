"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: automation admin writes (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { automationRulesRepo, type TriggerType, type Condition, type Action } from "@/lib/repositories/automationRules";

async function adminCtx(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  return ctx;
}

export async function createAutomationAction(
  slug: string,
  input: { name: string; trigger: TriggerType; conditions: Condition[]; actions: Action[] },
): Promise<void> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  await automationRulesRepo(svc).create(ctx.tenant.id, { ...input, enabled: true });
  revalidatePath(`/${slug}/admin/settings/automations`);
}

export async function toggleAutomationAction(slug: string, id: string, enabled: boolean): Promise<void> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  await automationRulesRepo(svc).update(ctx.tenant.id, id, { enabled });
  revalidatePath(`/${slug}/admin/settings/automations`);
}

export async function deleteAutomationAction(slug: string, id: string): Promise<void> {
  const ctx = await adminCtx(slug);
  const svc = createSupabaseServiceClient();
  await automationRulesRepo(svc).delete(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/settings/automations`);
}
