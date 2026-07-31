import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimationSessionsRepo, estimationVotesRepo, type EstimationSession, type EstimationVote } from "@/lib/repositories/estimationPoker";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import { updateIssue } from "@/lib/services/issues";

/** Next unestimated (no story_points), non-terminal-status issue in the project, oldest-created first. */
async function nextUnestimatedIssueId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  projectId: string,
  excludeIssueId?: string
): Promise<string | null> {
  const options = await fieldConfigRepo(supabase).listOptions(tenantId);
  const terminalKeys = options.filter((o) => o.field === "status" && o.is_terminal).map((o) => o.key);

  let q = supabase
    .from("issues")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .is("story_points", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (terminalKeys.length > 0) q = q.not("status", "in", `(${terminalKeys.join(",")})`);
  if (excludeIssueId) q = q.neq("id", excludeIssueId);

  const { data } = await q.maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function startEstimationSession(tenantId: string, projectId: string, userId: string): Promise<EstimationSession> {
  const supabase = await createSupabaseServerClient();
  const currentIssueId = await nextUnestimatedIssueId(supabase, tenantId, projectId);
  return estimationSessionsRepo(supabase).create({ tenant_id: tenantId, project_id: projectId, created_by: userId, current_issue_id: currentIssueId });
}

export async function listActiveEstimationSessions(tenantId: string, projectId: string): Promise<EstimationSession[]> {
  const supabase = await createSupabaseServerClient();
  return estimationSessionsRepo(supabase).listActiveForProject(tenantId, projectId);
}

export async function getEstimationSession(tenantId: string, id: string): Promise<EstimationSession | null> {
  const supabase = await createSupabaseServerClient();
  return estimationSessionsRepo(supabase).get(tenantId, id);
}

export async function listVotesForIssue(sessionId: string, issueId: string): Promise<EstimationVote[]> {
  const supabase = await createSupabaseServerClient();
  return estimationVotesRepo(supabase).listForIssue(sessionId, issueId);
}

export async function castVote(tenantId: string, sessionId: string, issueId: string, userId: string, value: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await estimationVotesRepo(supabase).castVote({ tenant_id: tenantId, session_id: sessionId, issue_id: issueId, user_id: userId, value });
}

export async function revealVotes(tenantId: string, sessionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await estimationSessionsRepo(supabase).update(tenantId, sessionId, { revealed: true });
}

/** Applies points to the current issue (if any) and advances to the next unestimated issue, or completes the session if none remain. */
export async function applyPointsAndAdvance(
  tenantId: string, sessionId: string, projectId: string, issueId: string, points: number, actor: { userId: string; label: string | null }
): Promise<{ nextIssueId: string | null }> {
  const supabase = await createSupabaseServerClient();
  await updateIssue(tenantId, issueId, { storyPoints: points }, actor);
  const nextIssueId = await nextUnestimatedIssueId(supabase, tenantId, projectId, issueId);
  await estimationSessionsRepo(supabase).update(tenantId, sessionId, {
    current_issue_id: nextIssueId,
    revealed: false,
    status: nextIssueId ? "active" : "completed",
  });
  return { nextIssueId };
}

/** Skips the current issue without applying points. */
export async function skipCurrentIssue(tenantId: string, sessionId: string, projectId: string, issueId: string): Promise<{ nextIssueId: string | null }> {
  const supabase = await createSupabaseServerClient();
  const nextIssueId = await nextUnestimatedIssueId(supabase, tenantId, projectId, issueId);
  await estimationSessionsRepo(supabase).update(tenantId, sessionId, {
    current_issue_id: nextIssueId,
    revealed: false,
    status: nextIssueId ? "active" : "completed",
  });
  return { nextIssueId };
}

export async function endEstimationSession(tenantId: string, sessionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await estimationSessionsRepo(supabase).update(tenantId, sessionId, { status: "completed" });
}
