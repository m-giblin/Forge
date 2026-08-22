import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { projectsRepo } from "@/lib/repositories/projects";
import InboxClient from "./InboxClient";

export default async function InboxPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  const [allNotifications, activeProjectIds] = await Promise.all([
    notificationsRepo(supabase).list(ctx.tenant.id, ctx.appUserId, { limit: 100, includeRead: true }),
    projectsRepo(supabase).listActiveIds(ctx.tenant.id),
  ]);

  // FORGE-190: drop notifications tied to an issue in a closed/archived
  // project — general notifications with no linked issue are unaffected.
  const issueIds = [...new Set(allNotifications.filter((n) => n.issueId).map((n) => n.issueId as string))];
  const activeSet = new Set(activeProjectIds);
  let inactiveIssueIds = new Set<string>();
  if (issueIds.length > 0) {
    const { data: issueRows } = await supabase.from("issues").select("id, project_id").in("id", issueIds);
    inactiveIssueIds = new Set((issueRows ?? []).filter((r) => !activeSet.has(r.project_id)).map((r) => r.id));
  }
  const notifications = allNotifications.filter((n) => !n.issueId || !inactiveIssueIds.has(n.issueId));

  return (
    <InboxClient
      slug={slug}
      userId={ctx.appUserId}
      tenantId={ctx.tenant.id}
      initialNotifications={notifications}
    />
  );
}
