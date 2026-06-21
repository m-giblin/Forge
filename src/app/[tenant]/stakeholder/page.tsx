import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StakeholderClient from "./StakeholderClient";

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  status: string | null;
  target_go_live: string | null;
  start_date: string | null;
  health: number;
  openBlockers: number;
  openCount: number;
  doneCount: number;
  totalCount: number;
  derivedStatus: "on_track" | "at_risk" | "blocked";
}

export interface WorkspaceKpis {
  onTrack: number;
  total: number;
  totalBlockers: number;
  sprintCompletion: number;
}

export default async function StakeholderPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  // Fetch non-archived projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, key, name, status, target_go_live, start_date")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "archived")
    .order("name");

  const projectList = projects ?? [];
  const projectIds = projectList.map((p) => p.id);

  // Fetch issue counts by status for all projects in one query
  let issueRows: { project_id: string; status: string }[] = [];
  if (projectIds.length > 0) {
    const { data } = await supabase
      .from("issues")
      .select("project_id, status")
      .in("project_id", projectIds);
    issueRows = data ?? [];
  }

  // Build per-project counts
  const countMap: Record<string, Record<string, number>> = {};
  for (const row of issueRows) {
    if (!countMap[row.project_id]) countMap[row.project_id] = {};
    countMap[row.project_id][row.status] = (countMap[row.project_id][row.status] ?? 0) + 1;
  }

  const projectSummaries: ProjectSummary[] = projectList.map((p) => {
    const counts = countMap[p.id] ?? {};
    const doneCount = counts["done"] ?? 0;
    const blockedCount = counts["blocked"] ?? 0;
    const inProgressCount = counts["in_progress"] ?? 0;
    const todoCount = counts["todo"] ?? 0;
    const totalCount = doneCount + blockedCount + inProgressCount + todoCount;
    const openCount = totalCount - doneCount;
    const health = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    let derivedStatus: "on_track" | "at_risk" | "blocked";
    if (blockedCount > 0) {
      derivedStatus = "blocked";
    } else if (health < 50) {
      derivedStatus = "at_risk";
    } else {
      derivedStatus = "on_track";
    }

    return {
      id: p.id,
      key: p.key,
      name: p.name,
      status: p.status,
      target_go_live: p.target_go_live,
      start_date: p.start_date,
      health,
      openBlockers: blockedCount,
      openCount,
      doneCount,
      totalCount,
      derivedStatus,
    };
  });

  // Workspace-level KPIs
  const onTrack = projectSummaries.filter((p) => p.derivedStatus === "on_track").length;
  const totalBlockers = projectSummaries.reduce((sum, p) => sum + p.openBlockers, 0);
  const totalDone = projectSummaries.reduce((sum, p) => sum + p.doneCount, 0);
  const totalAll = projectSummaries.reduce((sum, p) => sum + p.totalCount, 0);
  const sprintCompletion = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  const workspaceKpis: WorkspaceKpis = {
    onTrack,
    total: projectSummaries.length,
    totalBlockers,
    sprintCompletion,
  };

  return (
    <StakeholderClient
      projects={projectSummaries}
      workspaceKpis={workspaceKpis}
      tenantName={ctx.tenant.name}
      slug={slug}
    />
  );
}
