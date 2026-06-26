import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ideasRepo, ideaCommentsRepo, ideaAiTurnsRepo, thinkTankPillsRepo, ideaDecisionsRepo, ideaSignoffsRepo } from "@/lib/repositories/ideas";
import { membersRepo } from "@/lib/repositories/members";
import { projectsRepo } from "@/lib/repositories/projects";
import { usersRepo } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
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

  const [rawIdea, members, comments, recentAiTurns, customPillRows, decisions, signoffs] = await Promise.all([
    ideasRepo(supabase).getById(ctx.tenant.id, id),
    membersRepo(supabase).list(ctx.tenant.id),
    ideaCommentsRepo(supabase).list(ctx.tenant.id, id),
    ideaAiTurnsRepo(supabase).listRecent(ctx.tenant.id, id, 5),
    thinkTankPillsRepo(supabase).list(ctx.tenant.id),
    ideaDecisionsRepo(supabase).list(ctx.tenant.id, id),
    // Fails open: if migration 0029 hasn't been run yet, the table is absent —
    // return no sign-offs rather than breaking the whole idea page.
    ideaSignoffsRepo(supabase).list(ctx.tenant.id, id).catch(() => []),
  ]);

  if (!rawIdea) notFound();

  // Fetch creator/assignee names
  const userIds = [rawIdea.created_by, rawIdea.assigned_to].filter(Boolean) as string[];
  const userMap = await usersRepo(supabase).getDisplayNames(userIds);
  const creatorName = rawIdea.created_by ? (userMap.get(rawIdea.created_by) ?? null) : null;
  const assigneeName = rawIdea.assigned_to ? (userMap.get(rawIdea.assigned_to) ?? null) : null;

  const rawIdeaWithOkr = rawIdea as typeof rawIdea & { linked_okr_id?: string | null };
  let linkedOkrTitle: string | null = null;
  if (rawIdeaWithOkr.linked_okr_id) {
    const { data: okr } = await supabase.from("okrs").select("title").eq("id", rawIdeaWithOkr.linked_okr_id).eq("tenant_id", ctx.tenant.id).maybeSingle();
    linkedOkrTitle = okr?.title ?? null;
  }

  const idea = {
    ...rawIdea,
    number: (rawIdea as unknown as Record<string, unknown>).number as number | null ?? null,
    creator_name: creatorName,
    assignee_name: assigneeName,
    linked_okr_title: linkedOkrTitle,
  };

  const isCreator = idea.created_by === ctx.appUserId;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const canEdit = (isCreator || isAdmin) && !ctx.impersonating;

  // Fetch linked project + issue counts for provenance chain
  let linkedProjectKey: string | null = null;
  let provenanceProject: { key: string; name: string; open: number; done: number; total: number } | null = null;
  if (idea.linked_project_id) {
    const linked = await projectsRepo(supabase).getById(ctx.tenant.id, idea.linked_project_id);
    linkedProjectKey = linked?.key ?? null;
    if (linked) {
      const { data: issueCounts } = await supabase
        .from("issues")
        .select("status")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", linked.id);
      const rows = issueCounts ?? [];
      provenanceProject = {
        key: linked.key,
        name: linked.name,
        open: rows.filter((r) => r.status !== "done").length,
        done: rows.filter((r) => r.status === "done").length,
        total: rows.length,
      };
    }
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
      recentAiTurns={recentAiTurns}
      linkedProjectKey={linkedProjectKey}
      provenanceProject={provenanceProject}
      customPills={customPillRows.map((r) => ({ id: r.id, label: r.label, instruction: r.instruction }))}
      decisions={decisions}
      signoffs={signoffs}
    />
  );
}
