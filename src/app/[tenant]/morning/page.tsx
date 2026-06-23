import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadMorningBriefing } from "@/lib/services/morningBriefing";
import { listMembers } from "@/lib/services/members";
import MorningClient from "./MorningClient";

export default async function MorningPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const [briefing, members] = await Promise.all([
    loadMorningBriefing({
      tenantId: ctx.tenant.id,
      appUserId: ctx.appUserId,
      impersonating: ctx.impersonating,
    }),
    listMembers(ctx.tenant.id, ctx.impersonating),
  ]);

  const userName = members.find((m) => m.userId === ctx.appUserId)?.name ?? ctx.email ?? "there";
  const firstName = userName.split(" ")[0];

  return (
    <MorningClient
      slug={slug}
      role={ctx.role}
      firstName={firstName}
      briefing={briefing}
    />
  );
}
