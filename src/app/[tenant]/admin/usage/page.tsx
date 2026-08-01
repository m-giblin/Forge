import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: usage is admin-only cross-user aggregate; all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ideaAiTurnsRepo } from "@/lib/repositories/ideas";
import { usersRepo } from "@/lib/repositories/users";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import Bars from "@/components/patterns/admin/Bars";
import AdminList from "@/components/patterns/admin/AdminList";

function fmt(n: number): string {
  return n.toLocaleString();
}

function providerLabel(provider: string): string {
  if (provider === "platform:grok") return "Platform Grok";
  if (provider.startsWith("byo:")) {
    const p = provider.slice(4);
    const labels: Record<string, string> = {
      xai: "BYO xAI",
      openai: "BYO OpenAI",
      anthropic: "BYO Anthropic",
      gemini: "BYO Gemini",
    };
    return labels[p] ?? `BYO ${p}`;
  }
  return provider;
}

export default async function AIUsagePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const summary = await ideaAiTurnsRepo(svc).getUsageSummary(ctx.tenant.id, monthStart);

  // Fetch display names for users that appeared in this month's usage
  const userIds = summary.byUser.map((u) => u.userId).filter(Boolean) as string[];
  const userMap = await usersRepo(svc).getDisplayNames(ctx.tenant.id, userIds);

  const totalTokens = summary.totalTokensInput + summary.totalTokensOutput;

  return (
    <div>
      <PageHeader title="AI Usage" subtitle="Think Tank Sounding Board activity this month" />

      <div className="space-y-5 px-6 py-5">
        <StatsRow
          items={[
            { label: "Calls this month", value: fmt(summary.totalCalls) },
            { label: "Input tokens", value: fmt(summary.totalTokensInput) },
            { label: "Output tokens", value: fmt(summary.totalTokensOutput) },
            { label: "Total tokens", value: fmt(totalTokens), color: "#b7452f" },
          ]}
        />

        {summary.totalCalls === 0 ? (
          <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">
            No AI activity this month yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">By Provider — calls</p>
              <Bars
                color="#8c4632"
                items={summary.byProvider.map((row) => ({ label: providerLabel(row.provider), value: row.calls }))}
              />
            </div>

            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">By User</p>
              <AdminList
                items={summary.byUser.map((row) => ({
                  key: row.userId ?? "unknown",
                  title: row.userId ? (userMap.get(row.userId) ?? row.userId) : "Unknown",
                  subline: `${fmt(row.tokensInput + row.tokensOutput)} tokens`,
                  meta: `${fmt(row.calls)} calls`,
                }))}
              />
            </div>
          </div>
        )}

        {summary.totalCalls > 0 && (
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">By Provider — token share</p>
            <AdminList
              items={summary.byProvider.map((row) => ({
                key: row.provider,
                title: providerLabel(row.provider),
                subline: `${fmt(row.tokensInput + row.tokensOutput)} tokens${totalTokens > 0 ? ` (${Math.round(((row.tokensInput + row.tokensOutput) / totalTokens) * 100)}%)` : ""}`,
                meta: `${fmt(row.calls)} calls`,
              }))}
            />
          </div>
        )}

        <p className="text-[11px] text-[#a19d90]">
          Resets on the 1st of each month. Historical data is retained in the database.
        </p>
      </div>
    </div>
  );
}
