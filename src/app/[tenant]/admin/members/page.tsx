import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/services/members";
import { loadTenantFlags } from "@/lib/services/featureFlags";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { customRolesRepo } from "@/lib/repositories/customRoles";
import MembersManager from "./MembersManager";
import PageHeader from "@/components/patterns/PageHeader";

export default async function MembersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");
  const flags = await loadTenantFlags(ctx.tenant.id);

  const [members, invites, customRoles] = await Promise.all([
    listMembers(ctx.tenant.id, ctx.impersonating),
    listPendingInvites(ctx.tenant.id, ctx.impersonating),
    flags.rbac
      ? customRolesRepo(createSupabaseServiceClient()).list(ctx.tenant.id)
      : Promise.resolve([]),
  ]);

  const adminCount = members.filter((m) => m.role === "owner" || m.role === "admin").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle={`${members.length} member${members.length !== 1 ? "s" : ""} · ${adminCount} admin${adminCount !== 1 ? "s" : ""}`}
      />
      <div className="px-6">
        <MembersManager
          slug={slug}
          currentUserId={ctx.appUserId}
          members={members}
          invites={invites}
          readOnly={readOnly}
          showJobTitles={flags.job_titles ?? false}
          showRbac={flags.rbac ?? false}
          customRoles={customRoles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
        />
      </div>
    </div>
  );
}
