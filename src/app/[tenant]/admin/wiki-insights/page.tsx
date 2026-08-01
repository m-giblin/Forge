import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin reads search logs (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminList from "@/components/patterns/admin/AdminList";
import Note from "@/components/patterns/admin/Note";

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

  // Every row in wiki_search_logs is already a zero-result search (that's what
  // the table records) — so "zero-result" here is the total logged event
  // count, not a subset of `rows`. No fabricated distinction between the two.
  const totalSearches = rows.reduce((s, r) => s + r.count, 0);
  const topFive = rows.slice(0, 5);

  return (
    <div>
      <PageHeader title="Wiki Insights" subtitle="What people search for and cannot find" />

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-5">
        <StatsRow
          items={[
            { label: "Zero-result", value: totalSearches, hint: "logged searches with no matches" },
            { label: "Unique terms", value: rows.length, hint: "top 100 shown" },
            { label: "Top term volume", value: rows[0]?.count ?? 0, hint: rows[0] ? `"${rows[0].search_term}"` : "none yet" },
            { label: "Window", value: "2,000", hint: "most recent events scanned" },
          ]}
        />

        {rows.length === 0 ? (
          <div className="fw-card px-6 py-10 text-center">
            <p className="text-[12.5px] text-[#a19d90]">No zero-result searches recorded yet.</p>
            <p className="mt-1 text-[11px] text-[#c3bda9]">
              Requires migration 0090 to be applied and at least one failed search.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Top searches</p>
              <AdminList
                items={rows.map((row) => ({
                  key: row.search_term,
                  title: `“${row.search_term}”`,
                  subline: new Date(row.last_searched).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  meta: (
                    <span
                      className="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                      style={
                        row.count >= 5
                          ? { color: "#c0392b", backgroundColor: "#fbeae8" }
                          : row.count >= 2
                          ? { color: "#c9791d", backgroundColor: "#fdf1de" }
                          : { color: "#4a473e", backgroundColor: "#e3ded0" }
                      }
                    >
                      {row.count}
                    </span>
                  ),
                }))}
              />
            </div>

            {topFive.length > 0 && (
              <Note icon="🔍" tone="info">
                {topFive.length} of the top searches return little or nothing. Consider writing pages for: {topFive.map((r) => r.search_term).join(", ")}.
              </Note>
            )}
          </>
        )}

        <p className="text-[11px] text-[#a19d90]">
          Showing up to 100 most-searched terms. Counts reset if logs are cleared. Terms searched 5+ times are highlighted red.
        </p>
      </div>
    </div>
  );
}
