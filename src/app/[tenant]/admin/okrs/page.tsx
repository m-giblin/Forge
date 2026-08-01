import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin okr management: service-role to read members for owner display
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import OkrManager from "./OkrManager";
import PageHeader from "@/components/patterns/PageHeader";

export const revalidate = 60;

export default async function OkrsAdminPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("okrs")
    .select("id, title, description, quarter, status, progress, created_at, owner_id, users(email)")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false });

  const okrs = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string | null;
    quarter: string | null;
    status: string;
    progress: number;
    created_at: string;
    owner_id: string | null;
    users: { email: string } | null;
  }>;

  return (
    <div>
      <PageHeader title="OKRs" subtitle="Objectives and key results for the workspace" />
      <div className="px-6 py-5">
        <OkrManager slug={slug} initialOkrs={okrs} tenantId={ctx.tenant.id} isAdmin />
      </div>
    </div>
  );
}
