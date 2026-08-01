import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import BacklogRefinementClient from "./BacklogRefinementClient";

export default async function BacklogRefinementPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "edit_any_issue")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "eq", "archived")
    .order("name");

  const projects = (projectRows ?? []) as { id: string; key: string; name: string }[];
  const projectId = sp.project && projects.some((p) => p.id === sp.project) ? sp.project : (projects[0]?.id ?? "");

  const statuses = await fieldConfigRepo(svc).listOptions(ctx.tenant.id);
  const statusOptions = statuses.filter((s) => s.field === "status").sort((a, b) => a.position - b.position);
  // "Backlog" is whatever workflow step sits first; "ready" is the very next
  // one — not the tenant's configured default-for-new-issues, so this always
  // respects the adjacent-transition restriction if that toggle is on.
  const backlogStatus = statusOptions[0] ?? null;
  const readyStatus = statusOptions[1] ?? statusOptions[0] ?? null;

  const { data: issueRows } = projectId && backlogStatus
    ? await svc
        .from("issues")
        .select("id, number, title, description, type, priority, story_points")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", projectId)
        .eq("status", backlogStatus.key)
        .order("position")
    : { data: [] };

  const types = statuses.filter((s) => s.field === "type").sort((a, b) => a.position - b.position);
  const priorities = statuses.filter((s) => s.field === "priority").sort((a, b) => a.position - b.position);

  return (
    <main className="w-full">
      <BacklogRefinementClient
        slug={slug}
        projects={projects}
        projectId={projectId}
        backlogStatus={backlogStatus}
        readyStatus={readyStatus}
        types={types.map((t) => ({ key: t.key, label: t.label }))}
        priorities={priorities.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
        issues={(issueRows ?? []).map((i) => ({
          id: i.id as string,
          number: i.number as number,
          title: i.title as string,
          description: i.description as string | null,
          type: i.type as string,
          priority: i.priority as string,
          storyPoints: i.story_points as number | null,
        }))}
      />
    </main>
  );
}
