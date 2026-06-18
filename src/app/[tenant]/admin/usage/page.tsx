import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: usage is admin-only cross-user aggregate; all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ideaAiTurnsRepo } from "@/lib/repositories/ideas";
import { usersRepo } from "@/lib/repositories/users";

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
  const userMap = await usersRepo(svc).getDisplayNames(userIds);

  const totalTokens = summary.totalTokensInput + summary.totalTokensOutput;

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">AI Usage</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Think Tank Sounding Board activity this month. Token counts are captured directly
        from each provider&apos;s API response.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Calls this month</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{fmt(summary.totalCalls)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Input tokens</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{fmt(summary.totalTokensInput)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Output tokens</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{fmt(summary.totalTokensOutput)}</p>
        </div>
      </div>

      {summary.totalCalls === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-400">No AI activity this month yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-6">
          {/* By provider */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-medium text-neutral-700">By Provider</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {summary.byProvider.map((row) => (
                <div key={row.provider} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800">{providerLabel(row.provider)}</p>
                    <p className="text-xs text-neutral-400">
                      {fmt(row.tokensInput + row.tokensOutput)} tokens
                      {totalTokens > 0 && (
                        <span className="ml-1">
                          ({Math.round(((row.tokensInput + row.tokensOutput) / totalTokens) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-neutral-700">{fmt(row.calls)} calls</span>
                </div>
              ))}
            </div>
          </div>

          {/* By user */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-medium text-neutral-700">By User</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {summary.byUser.map((row) => (
                <div key={row.userId ?? "unknown"} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800">
                      {row.userId ? (userMap.get(row.userId) ?? row.userId) : "Unknown"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {fmt(row.tokensInput + row.tokensOutput)} tokens
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-neutral-700">{fmt(row.calls)} calls</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Resets on the 1st of each month. Historical data is retained in the database.
      </p>
    </section>
  );
}
