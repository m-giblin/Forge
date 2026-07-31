import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import CfdClient from "./CfdClient";

export default async function CfdPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "eq", "archived")
    .order("name");

  const projects = (projectRows ?? []) as { id: string; name: string }[];
  const selectedProjectId = sp.project && projects.some((p) => p.id === sp.project) ? sp.project : (projects[0]?.id ?? "");

  return (
    <main className="w-full px-6 py-8">
      <CfdClient slug={slug} projects={projects} initialProjectId={selectedProjectId} />
    </main>
  );
}
