import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin read of tenants row
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PermissionOverrides } from "@/lib/permissions";
import PermissionsClient from "./PermissionsClient";

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
    <div className="max-w-2xl mx-auto px-6 py-8">
      <PermissionsClient slug={slug} initial={initial} />
    </div>
  );
}
