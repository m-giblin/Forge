import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin reads search logs (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

interface SearchLogRow {
  search_term: string;
  count: number;
  last_searched: string;
}

export default async function WikiInsightsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();

  // Aggregate zero-result searches: group by term, count, last seen
  const { data: raw } = await svc
    .from("wiki_search_logs")
    .select("search_term, searched_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("searched_at", { ascending: false })
    .limit(2000);

  // Aggregate in JS (avoid a raw SQL RPC for now)
  const byTerm: Record<string, { count: number; last: string }> = {};
  for (const row of raw ?? []) {
    if (!byTerm[row.search_term]) {
      byTerm[row.search_term] = { count: 0, last: row.searched_at };
    }
    byTerm[row.search_term].count++;
    if (row.searched_at > byTerm[row.search_term].last) {
      byTerm[row.search_term].last = row.searched_at;
    }
  }

  const rows: SearchLogRow[] = Object.entries(byTerm)
    .map(([term, v]) => ({ search_term: term, count: v.count, last_searched: v.last }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Wiki Insights</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Searches that returned zero results — use these to identify content gaps in your wiki.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center">
          <p className="text-sm text-neutral-400">No zero-result searches recorded yet.</p>
          <p className="mt-1 text-xs text-neutral-300">
            Requires migration 0090 to be applied and at least one failed search.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">Search term</th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide text-right">Searches</th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide text-right">Last searched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((row) => (
                <tr key={row.search_term} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    &ldquo;{row.search_term}&rdquo;
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.count >= 5 ? "bg-red-50 text-red-700" :
                      row.count >= 2 ? "bg-amber-50 text-amber-700" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>
                      {row.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-400 text-xs">
                    {new Date(row.last_searched).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Showing up to 100 most-searched terms. Counts reset if logs are cleared.
        Terms searched 5+ times are highlighted red.
      </p>
    </div>
  );
}
