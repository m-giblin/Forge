import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ideasRepo, ideaCommentsRepo, ideaAiTurnsRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import MarkdownBlock from "./MarkdownBlock";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  researching: "Researching",
  maturing: "Maturing",
  ready: "Ready for Conversion",
  converted: "Converted",
  archived: "Archived",
};

export default async function IdeaPrintPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const [idea, comments, aiTurns] = await Promise.all([
    ideasRepo(supabase).getById(ctx.tenant.id, id),
    ideaCommentsRepo(supabase).list(ctx.tenant.id, id),
    ideaAiTurnsRepo(supabase).listRecent(ctx.tenant.id, id, 10),
  ]);

  if (!idea) notFound();

  const topLevel = comments.filter((c) => !c.isDeleted && !c.parentId);
  const repliesMap = new Map<string, typeof comments>();
  for (const c of comments) {
    if (c.parentId && !c.isDeleted) {
      const arr = repliesMap.get(c.parentId) ?? [];
      arr.push(c);
      repliesMap.set(c.parentId, arr);
    }
  }

  const exportedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { margin: 1in; }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      <div className="mx-auto max-w-2xl px-8 py-10 text-neutral-900">
        {/* Actions bar — hidden when printing */}
        <div className="no-print mb-8 flex items-center gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-500">Print this page or save as PDF using your browser&#39;s Print dialog.</span>
          <button
            onClick={() => typeof window !== "undefined" && window.print()}
            className="ml-auto rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            suppressHydrationWarning
          >
            Print / Save as PDF
          </button>
          <a
            href={`/${slug}/think-tank/${id}/export`}
            className="rounded-lg border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Download .md
          </a>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-2xl font-bold leading-tight">{idea.title}</h1>

        {/* Meta */}
        <div className="mb-6 space-y-1 text-sm text-neutral-500">
          <div>
            <span className="font-medium text-neutral-700">Status:</span>{" "}
            {STATUS_LABELS[idea.status] ?? idea.status}
          </div>
          {idea.tags.length > 0 && (
            <div>
              <span className="font-medium text-neutral-700">Tags:</span>{" "}
              {idea.tags.join(", ")}
            </div>
          )}
          {idea.review_by && (
            <div>
              <span className="font-medium text-neutral-700">Review by:</span>{" "}
              {idea.review_by}
            </div>
          )}
          <div>
            <span className="font-medium text-neutral-700">Exported:</span>{" "}
            {exportedAt}
          </div>
        </div>

        {/* Description */}
        {idea.description && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-800 border-b border-neutral-200 pb-1">
              Description
            </h2>
            <MarkdownBlock>{idea.description}</MarkdownBlock>
          </section>
        )}

        {/* Comments */}
        {topLevel.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-800 border-b border-neutral-200 pb-1">
              Discussion ({topLevel.length} comment{topLevel.length !== 1 ? "s" : ""})
            </h2>
            <div className="space-y-5">
              {topLevel.map((c) => {
                const replies = repliesMap.get(c.id) ?? [];
                return (
                  <div key={c.id}>
                    <div className="text-xs text-neutral-500 mb-1">
                      <span className="font-semibold text-neutral-700">{c.authorName ?? "Unknown"}</span>
                      {" · "}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-neutral-700">{c.body}</p>
                    {c.attachments.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-400">
                        Attachments: {c.attachments.map((a) => a.filename).join(", ")}
                      </p>
                    )}
                    {replies.length > 0 && (
                      <div className="mt-3 border-l-2 border-neutral-100 pl-4 space-y-3">
                        {replies.map((r) => (
                          <div key={r.id}>
                            <div className="text-xs text-neutral-500 mb-1">
                              <span className="font-semibold text-neutral-700">{r.authorName ?? "Unknown"}</span>
                              {" · "}
                              {new Date(r.createdAt).toLocaleDateString()}
                            </div>
                            <p className="text-sm whitespace-pre-wrap text-neutral-700">{r.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* AI Sounding Board */}
        {aiTurns.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-800 border-b border-neutral-200 pb-1">
              AI Sounding Board
            </h2>
            <div className="space-y-6">
              {aiTurns.map((turn) => (
                <div key={turn.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    {turn.pills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {turn.pills.map((p) => (
                          <span key={p} className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-neutral-400">
                      {new Date(turn.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {turn.userInput && (
                    <p className="mb-2 text-sm font-medium text-neutral-700 italic">
                      Q: {turn.userInput}
                    </p>
                  )}
                  <MarkdownBlock>{turn.aiResponse}</MarkdownBlock>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
          Exported from Forge · {exportedAt}
        </div>
      </div>
    </>
  );
}
