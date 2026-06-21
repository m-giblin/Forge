import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RoadmapClient from "./RoadmapClient";

export type ProjectRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  created_at: string;
  target_go_live: string | null;
  roadmap_position: number | null;
  roadmap_width: number | null;
};

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, key, name, status, created_at, target_go_live, archived_at, roadmap_position, roadmap_width")
    .eq("tenant_id", ctx.tenant.id)
    .is("archived_at", null)
    .order("created_at");

  const rows: ProjectRow[] = (projects ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    status: p.status,
    created_at: p.created_at,
    target_go_live: p.target_go_live ?? null,
    // Falls back to null until migration 0053 runs — RoadmapClient computes from created_at in that case
    roadmap_position: (p as Record<string, unknown>).roadmap_position as number | null ?? null,
    roadmap_width: (p as Record<string, unknown>).roadmap_width as number | null ?? null,
  }));

  const projectIds = rows.map((p) => p.id);

  type IssueCountMap = Record<string, { todo: number; in_progress: number; done: number; total: number }>;
  const issueCounts: IssueCountMap = {};

  if (projectIds.length > 0) {
    const { data: issues } = await supabase
      .from("issues")
      .select("project_id, status")
      .eq("tenant_id", ctx.tenant.id)
      .in("project_id", projectIds);

    for (const issue of issues ?? []) {
      const pid = issue.project_id as string;
      if (!issueCounts[pid]) issueCounts[pid] = { todo: 0, in_progress: 0, done: 0, total: 0 };
      issueCounts[pid].total++;
      const s = issue.status as string;
      if (s === "todo" || s === "backlog") issueCounts[pid].todo++;
      else if (s === "in_progress" || s === "in_review") issueCounts[pid].in_progress++;
      else if (s === "done") issueCounts[pid].done++;
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <RoadmapClient slug={slug} projects={rows} issueCounts={issueCounts} />
    </main>
  );
}
