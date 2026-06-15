import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadThinkTankPage } from "@/lib/services/thinkTank";
import ThinkTankListing from "./ThinkTankListing";

export default async function ThinkTankPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const data = await loadThinkTankPage(ctx.tenant.id, ctx.appUserId, ctx.impersonating);

  const canCreate = ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member";

  return (
    <ThinkTankListing
      slug={slug}
      thinkTankId={data.thinkTank.id}
      ideas={data.ideas}
      allTags={data.allTags}
      members={data.members}
      canCreate={canCreate}
    />
  );
}
