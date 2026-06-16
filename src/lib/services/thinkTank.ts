import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ideasRepo, type IdeaSummary, type IdeaRow, type ThinkTankRow } from "@/lib/repositories/ideas";
import { membersRepo } from "@/lib/repositories/members";

async function readClient(impersonating: boolean) {
  return impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
}

export async function getOrCreateDefaultThinkTank(
  tenantId: string,
  userId: string,
  impersonating = false
): Promise<ThinkTankRow> {
  const supabase = await readClient(impersonating);
  return ideasRepo(supabase).getOrCreateDefaultThinkTank(tenantId, userId);
}

export interface ThinkTankPageData {
  thinkTank: ThinkTankRow;
  ideas: IdeaSummary[];
  allTags: string[];
  members: Array<{ id: string; name: string | null; email: string }>;
}

export async function loadThinkTankPage(
  tenantId: string,
  userId: string,
  impersonating = false
): Promise<ThinkTankPageData> {
  const supabase = await readClient(impersonating);
  const repo = ideasRepo(supabase);

  const [thinkTank, ideas, allTags, members] = await Promise.all([
    repo.getOrCreateDefaultThinkTank(tenantId, userId),
    repo.list(tenantId, { excludeArchived: false, userId }),
    repo.getAllTags(tenantId),
    membersRepo(supabase).list(tenantId),
  ]);

  return {
    thinkTank,
    ideas,
    allTags,
    members: members.map((m) => ({ id: m.userId, name: m.name, email: m.email })),
  };
}

export async function createIdea(
  tenantId: string,
  thinkTankId: string,
  userId: string,
  input: {
    title: string;
    description?: string | null;
    tags?: string[];
    is_private?: boolean;
    assigned_to?: string | null;
    review_by?: string | null;
  }
): Promise<IdeaRow> {
  const supabase = await createSupabaseServerClient();
  return ideasRepo(supabase).create({
    tenant_id: tenantId,
    think_tank_id: thinkTankId,
    created_by: userId,
    ...input,
  });
}

export async function updateIdea(
  tenantId: string,
  ideaId: string,
  patch: Partial<Pick<IdeaRow, "title" | "description" | "status" | "is_private" | "tags" | "assigned_to" | "linked_project_id" | "converted_at" | "review_by">>
): Promise<IdeaRow> {
  const supabase = await createSupabaseServerClient();
  return ideasRepo(supabase).update(tenantId, ideaId, patch);
}
