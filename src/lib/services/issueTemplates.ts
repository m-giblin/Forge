import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueTemplatesRepo, type IssueTemplate } from "@/lib/repositories/issueTemplates";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

const MAX_TEMPLATES = 20;

export async function listIssueTemplates(tenantId: string): Promise<IssueTemplate[]> {
  const supabase = await createSupabaseServerClient();
  return issueTemplatesRepo(supabase).list(tenantId);
}

export async function addIssueTemplate(
  tenantId: string,
  input: { name: string; titlePrefix: string; type: string; priority: string }
): Promise<void> {
  if (!input.name.trim()) throw new Error("Name is required.");
  const supabase = await createSupabaseServerClient();
  const repo = issueTemplatesRepo(supabase);

  const existing = await repo.list(tenantId);
  if (existing.length >= MAX_TEMPLATES) throw new Error(`Workspaces are limited to ${MAX_TEMPLATES} issue templates.`);
  if (existing.some((t) => t.name.toLowerCase() === input.name.trim().toLowerCase())) {
    throw new Error(`A template called "${input.name}" already exists.`);
  }

  // Validate against this tenant's actual configured type/priority options —
  // the old hardcoded template list could silently no-op if a tenant had
  // customized away the defaults (matchType/matchPri lookups returning undefined).
  const options = await fieldConfigRepo(supabase).listOptions(tenantId);
  if (!options.some((o) => o.field === "type" && o.key === input.type)) throw new Error("Unknown issue type.");
  if (!options.some((o) => o.field === "priority" && o.key === input.priority)) throw new Error("Unknown priority.");

  await repo.add({
    tenant_id: tenantId,
    name: input.name.trim(),
    title_prefix: input.titlePrefix,
    type: input.type,
    priority: input.priority,
    position: existing.length,
  });
}

export async function deleteIssueTemplate(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await issueTemplatesRepo(supabase).delete(tenantId, id);
}
