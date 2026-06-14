import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { getIssue, loadIssueActivity } from "@/lib/services/issues";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import { listMembers } from "@/lib/services/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
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
  const [project, members, activity] = await Promise.all([
    projectsRepo(client).getById(ctx.tenant.id, issue.project_id),
    listMembers(ctx.tenant.id, ctx.impersonating),
    loadIssueActivity(ctx.tenant.id, issue.id, ctx.impersonating),
  ]);

  const readOnly = ctx.impersonating || ctx.role === "viewer";
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <Link href={`/${slug}/board?project=${project?.key ?? ""}`} className="text-sm text-neutral-500 hover:text-neutral-800">← Board</Link>
      <IssueDetail
        slug={slug}
        issue={issue}
        issueKey={`${project?.key ?? "?"}-${issue.number}`}
        statuses={schema.statuses}
        priorities={schema.priorities}
        types={schema.types}
        categories={schema.categories}
        customFields={schema.customFields}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        comments={activity.comments}
        events={activity.events}
        readOnly={readOnly}
        canDelete={canDelete}
      />
    </main>
  );
}
