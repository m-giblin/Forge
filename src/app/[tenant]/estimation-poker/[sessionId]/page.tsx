import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getEstimationSession, listVotesForIssue } from "@/lib/services/estimationPoker";
import { listMembers } from "@/lib/services/members";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import EstimationPokerRoom from "./EstimationPokerRoom";

export default async function EstimationPokerRoomPage({
  params,
}: {
  params: Promise<{ tenant: string; sessionId: string }>;
}) {
  const { tenant: slug, sessionId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (ctx.role === "viewer") redirect(`/${slug}/board`);

  const session = await getEstimationSession(ctx.tenant.id, sessionId);
  if (!session) notFound();

  const svc = createSupabaseServiceClient();
  const [projectRes, members, options, currentIssueRes, votes] = await Promise.all([
    svc.from("projects").select("id, key, name").eq("tenant_id", ctx.tenant.id).eq("id", session.project_id).maybeSingle(),
    listMembers(ctx.tenant.id, ctx.impersonating),
    fieldConfigRepo(svc).listOptions(ctx.tenant.id),
    session.current_issue_id
      ? svc.from("issues").select("id, number, title, description, type, priority, story_points").eq("tenant_id", ctx.tenant.id).eq("id", session.current_issue_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.current_issue_id ? listVotesForIssue(session.id, session.current_issue_id) : Promise.resolve([]),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  const priorities = options.filter((o) => o.field === "priority").sort((a, b) => a.position - b.position);
  const types = options.filter((o) => o.field === "type").sort((a, b) => a.position - b.position);

  const currentIssue = currentIssueRes.data as { id: string; number: number; title: string; description: string | null; type: string; priority: string; story_points: number | null } | null;

  return (
    <main className="w-full">
      <EstimationPokerRoom
        slug={slug}
        sessionId={session.id}
        projectId={session.project_id}
        project={{ key: project.key as string, name: project.name as string }}
        meUserId={ctx.appUserId}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        priorities={priorities.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
        types={types.map((t) => ({ key: t.key, label: t.label }))}
        initialStatus={session.status}
        initialCurrentIssueId={session.current_issue_id}
        initialRevealed={session.revealed}
        initialIssue={currentIssue ? {
          id: currentIssue.id, number: currentIssue.number, title: currentIssue.title, description: currentIssue.description,
          type: currentIssue.type, priority: currentIssue.priority, storyPoints: currentIssue.story_points,
        } : null}
        initialVotes={votes.map((v) => ({ userId: v.user_id, value: v.value }))}
      />
    </main>
  );
}
