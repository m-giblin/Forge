import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import BurndownClient from "./BurndownClient";

export default async function BurndownPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ sprintId?: string; project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const [sprintRes, projectRes] = await Promise.all([
    svc.from("sprints")
      .select("id, name, status, project_id, start_date, end_date")
      .eq("tenant_id", ctx.tenant.id)
      .in("status", ["active", "completed", "planning"])
      .order("start_date", { ascending: false })
      .limit(30),
    svc.from("projects")
      .select("id, name")
      .eq("tenant_id", ctx.tenant.id)
      .not("status", "eq", "archived")
      .order("name"),
  ]);

  const sprints = (sprintRes.data ?? []) as { id: string; name: string; status: string; project_id: string; start_date: string; end_date: string }[];
  const projects = (projectRes.data ?? []) as { id: string; name: string }[];

  // Default to active sprint or most recent
  const activeSprint = sprints.find((s) => s.status === "active") ?? sprints[0] ?? null;
  const selectedSprintId = sp.sprintId ?? activeSprint?.id ?? "";

  return (
    <main className="w-full px-6 py-8">
      <BurndownClient slug={slug} sprints={sprints} projects={projects} initialSprintId={selectedSprintId} />
    </main>
  );
}
