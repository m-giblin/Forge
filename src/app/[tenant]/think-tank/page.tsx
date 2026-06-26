import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadThinkTankPage } from "@/lib/services/thinkTank";
// eslint-disable-next-line no-restricted-imports -- service-role to read platform_config (tenant setting, no user JWT context needed)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import ThinkTankListing from "./ThinkTankListing";

export default async function ThinkTankPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const [data, blindRow] = await Promise.all([
    loadThinkTankPage(ctx.tenant.id, ctx.appUserId, ctx.impersonating),
    svc.from("platform_config").select("value").eq("tenant_id", ctx.tenant.id).eq("key", "tt_blind_voting").maybeSingle(),
  ]);

  const canCreate = ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member";
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const blindVoting = blindRow.data?.value === "true";

  return (
    <ThinkTankListing
      slug={slug}
      thinkTankId={data.thinkTank.id}
      ideas={data.ideas}
      allTags={data.allTags}
      members={data.members}
      canCreate={canCreate}
      blindVoting={blindVoting}
      isAdmin={isAdmin}
    />
  );
}
