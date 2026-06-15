import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ideasRepo, ideaCommentsRepo, ideaAiTurnsRepo } from "@/lib/repositories/ideas";
import { membersRepo } from "@/lib/repositories/members";
import { projectsRepo } from "@/lib/repositories/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import IdeaDetail from "./IdeaDetail";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const [rawIdea, members, comments, lastAiTurn] = await Promise.all([
    ideasRepo(supabase).getById(ctx.tenant.id, id),
    membersRepo(supabase).list(ctx.tenant.id),
    ideaCommentsRepo(supabase).list(ctx.tenant.id, id),
    ideaAiTurnsRepo(supabase).getLatest(ctx.tenant.id, id),
  ]);

  if (!rawIdea) notFound();

  // Fetch creator/assignee names
  const userIds = [rawIdea.created_by, rawIdea.assigned_to].filter(Boolean) as string[];
  let creatorName: string | null = null;
  let assigneeName: string | null = null;

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    const userMap = new Map((users ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name]));
    creatorName = rawIdea.created_by ? (userMap.get(rawIdea.created_by) ?? null) : null;
    assigneeName = rawIdea.assigned_to ? (userMap.get(rawIdea.assigned_to) ?? null) : null;
  }

  const idea = {
    ...rawIdea,
    number: (rawIdea as unknown as Record<string, unknown>).number as number | null ?? null,
    creator_name: creatorName,
    assignee_name: assigneeName,
  };

  const isCreator = idea.created_by === ctx.appUserId;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const canEdit = (isCreator || isAdmin) && !ctx.impersonating;

  // Fetch linked project key so the "View Project →" link can use /?project=KEY
  let linkedProjectKey: string | null = null;
  if (idea.linked_project_id) {
    const linked = await projectsRepo(supabase).getById(ctx.tenant.id, idea.linked_project_id);
    linkedProjectKey = linked?.key ?? null;
  }

  return (
    <IdeaDetail
      slug={slug}
      idea={idea}
      canEdit={canEdit}
      members={members.map((m) => ({ id: m.userId, name: m.name, email: m.email }))}
      thinkTankName="TT"
      comments={comments}
      currentUserId={ctx.appUserId}
      isAdmin={isAdmin}
      isViewer={ctx.role === "viewer"}
      lastAiTurn={lastAiTurn}
      linkedProjectKey={linkedProjectKey}
    />
  );
}
