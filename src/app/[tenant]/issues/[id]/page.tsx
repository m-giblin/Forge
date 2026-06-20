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
import { issueLinksRepo } from "@/lib/repositories/issueLinks";
import IssueDetail from "./IssueDetail";

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

  // Migration 0044 guard — graceful if not run yet
  const linksRepo = issueLinksRepo(svcClient);
  const projectKey = project?.key ?? "";
  const [subIssues, links] = await Promise.all([
    linksRepo.listChildren(ctx.tenant.id, issue.id).catch(() => []),
    linksRepo.listForIssue(ctx.tenant.id, issue.id, projectKey).catch(() => []),
  ]);

  const readOnly = ctx.impersonating || ctx.role === "viewer";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
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
        watchers={watchers.map((w) => w.userId)}
        currentUserId={ctx.appUserId}
        subIssues={subIssues}
        links={links}
      />
    </main>
  );
}
