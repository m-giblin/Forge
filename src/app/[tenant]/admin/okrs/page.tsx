import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin okr management: service-role to read members for owner display
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import OkrManager from "./OkrManager";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">OKRs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Define objectives and key results. Link ideas to OKRs to track strategic alignment.
        </p>
      </div>
      <OkrManager slug={slug} initialOkrs={okrs} tenantId={ctx.tenant.id} isAdmin />
    </div>
  );
}
