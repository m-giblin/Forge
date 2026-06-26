import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { getOrCreateDefaultThinkTank } from "@/lib/services/thinkTank";
import { membersRepo } from "@/lib/repositories/members";
import { tenantIdeaTemplatesRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import IdeaCreateForm from "./IdeaCreateForm";

export default async function NewIdeaPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role === "viewer") redirect(`/${slug}/think-tank`);

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const [thinkTank, members, tenantTemplates, okrData] = await Promise.all([
    getOrCreateDefaultThinkTank(ctx.tenant.id, ctx.appUserId, ctx.impersonating),
    membersRepo(supabase).list(ctx.tenant.id),
    tenantIdeaTemplatesRepo(supabase).list(ctx.tenant.id),
    supabase.from("okrs").select("id, title, quarter").eq("tenant_id", ctx.tenant.id).eq("status", "active").order("quarter"),
  ]);
  const okrs = (okrData.data ?? []) as Array<{ id: string; title: string; quarter: string | null }>;

  const memberOptions = members.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
  }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/${slug}/think-tank`}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Think Tank
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">New Idea</h1>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <IdeaCreateForm
          slug={slug}
          thinkTankId={thinkTank.id}
          members={memberOptions}
          tenantTemplates={tenantTemplates}
          okrs={okrs}
        />
      </div>
    </div>
  );
}
