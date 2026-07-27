import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { getIssue, loadIssueActivity } from "@/lib/services/issues";
import { issueAttachmentsRepo } from "@/lib/repositories/issueAttachments";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import { listMembers } from "@/lib/services/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { issueWatchersRepo } from "@/lib/repositories/issueWatchers";
import { issueAssigneesRepo } from "@/lib/repositories/issueAssignees";
import { issueLinksRepo } from "@/lib/repositories/issueLinks";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { slaPoliciesRepo } from "@/lib/repositories/slaPolicies";
import { computeSlaTimer } from "@/lib/services/sla";
import IssueDetail from "./IssueDetail";
import { listTimeLogsAction, getIssueTimerAction } from "./timeActions";

export default async function IssuePage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const issue = await getIssue(ctx.tenant.id, id, ctx.impersonating);
  if (!issue) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 text-center text-sm text-neutral-500">
        Issue not found. <Link href={`/${slug}/board`} className="text-neutral-900 underline">Back to board</Link>
      </main>
    );
  }

  const schema = await getTenantSchema(ctx.tenant.id, ctx.impersonating);
  const client = ctx.impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const svcClient = createSupabaseServiceClient();
  const [project, members, activity, attachments, watchers] = await Promise.all([
    projectsRepo(client).getById(ctx.tenant.id, issue.project_id),
    listMembers(ctx.tenant.id, ctx.impersonating),
    loadIssueActivity(ctx.tenant.id, issue.id, ctx.impersonating),
    issueAttachmentsRepo(client).list(ctx.tenant.id, issue.id),
    issueWatchersRepo(svcClient).list(ctx.tenant.id, issue.id),
  ]);

  // Full assignee set (0087). Guarded: graceful if the migration isn't applied yet.
  const assigneeSet = await issueAssigneesRepo(svcClient)
    .listForIssue(ctx.tenant.id, issue.id)
    .catch(() => []);
  const initialAssigneeIds = assigneeSet.map((a) => a.userId);

  // Migration 0044 guard — graceful if not run yet
  const linksRepo = issueLinksRepo(svcClient);
  const projectKey = project?.key ?? "";
  const parentIssuePromise = issue.parent_id
    ? Promise.resolve(
        svcClient.from("issues").select("id, number, title, projects!inner(key)").eq("id", issue.parent_id).eq("tenant_id", ctx.tenant.id).single()
      ).then((q) => q).then((r) => r.data as { id: string; number: number; title: string; projects: { key: string } } | null).catch(() => null)
    : Promise.resolve(null as { id: string; number: number; title: string; projects: { key: string } } | null);

  const [subIssues, links, gitLinks, slaPolicies, signoffsRaw, timeLogs, activeTimer, parentIssue] = await Promise.all([
    linksRepo.listChildren(ctx.tenant.id, issue.id).catch(() => []),
    linksRepo.listForIssue(ctx.tenant.id, issue.id, projectKey).catch(() => []),
    gitIntegrationRepo(svcClient).listCodeLinks(ctx.tenant.id, issue.id).catch(() => []),
    slaPoliciesRepo(svcClient).listEnabled(ctx.tenant.id).catch(() => []),
    Promise.resolve(
      svcClient.from("issue_signoffs")
        .select("id, role_label, signed_by, signed_at, signer:users!signed_by(full_name_encrypted, email_encrypted)")
        .eq("issue_id", issue.id)
        .eq("tenant_id", ctx.tenant.id)
        .order("created_at")
    ).then((r) => r.data ?? []).catch(() => []),
    listTimeLogsAction(slug, issue.id).catch(() => []),
    getIssueTimerAction(slug, issue.id).catch(() => null),
    parentIssuePromise,
  ]);
  // Flatten signer label (use email since PII not decrypted here — good enough for display)
  const signoffs = signoffsRaw.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    role_label: s.role_label as string,
    signed_by: s.signed_by as string | null,
    signed_at: s.signed_at as string | null,
    signer_label: null as string | null, // decryption deferred — show "Signed" for now
  }));
  const slaTimer = computeSlaTimer(issue, slaPolicies);

  const readOnly = ctx.impersonating || ctx.role === "viewer";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="px-2 py-3">
      <IssueDetail
        slug={slug}
        issue={issue}
        issueKey={`${projectKey}-${issue.number}`}
        projectKey={projectKey}
        statuses={schema.statuses}
        priorities={schema.priorities}
        types={schema.types}
        categories={schema.categories}
        customFields={schema.customFields}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        comments={activity.comments}
        events={activity.events}
        initialAttachments={attachments}
        readOnly={readOnly}
        canDelete={canDelete}
        userRole={ctx.role}
        watchers={watchers.map((w) => w.userId)}
        initialAssigneeIds={initialAssigneeIds}
        currentUserId={ctx.appUserId}
        parentIssue={parentIssue ?? undefined}
        subIssues={subIssues}
        links={links}
        gitLinks={gitLinks}
        slaTimer={slaTimer}
        signoffs={signoffs}
        initialTimeLogs={timeLogs}
        initialTimerStartedAt={activeTimer?.active ? activeTimer.startedAt ?? null : null}
        timeEstimateMinutes={(issue as Record<string, unknown>).time_estimate_minutes as number | null ?? null}
      />
    </main>
  );
}
