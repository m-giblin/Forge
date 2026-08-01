import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin read of tenants row
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PermissionOverrides } from "@/lib/permissions";
import PermissionsClient from "./PermissionsClient";
import PageHeader from "@/components/patterns/PageHeader";

export default async function PermissionsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const { data } = await createSupabaseServiceClient()
    .from("tenants")
    .select("permission_overrides")
    .eq("id", ctx.tenant.id)
    .maybeSingle();

  const initial = (data?.permission_overrides ?? {}) as PermissionOverrides;

  return (
    <div className="space-y-6">
      <PageHeader title="Permissions" subtitle="What each built-in role can do" />
      <div className="px-6">
        <PermissionsClient slug={slug} initial={initial} />
      </div>
    </div>
  );
}
