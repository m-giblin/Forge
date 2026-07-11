import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role read: canvas spans idea + node + edge tables (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ideasRepo } from "@/lib/repositories/ideas";
import { ideaCanvasRepo } from "@/lib/repositories/ideaCanvas";
import IdeaCanvasBoard from "./IdeaCanvasBoard";

export default async function IdeaCanvasPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: ideaId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const idea = await ideasRepo(svc).getById(ctx.tenant.id, ideaId);
  if (!idea) notFound();

  const canvas = ideaCanvasRepo(svc);
  let nodes, edges;
  try {
    [nodes, edges] = await Promise.all([
      canvas.listNodes(ctx.tenant.id, ideaId),
      canvas.listEdges(ctx.tenant.id, ideaId),
    ]);
  } catch {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-neutral-500">
          Idea Canvas isn&apos;t set up yet — migration <code className="font-mono">0105_idea_canvas.sql</code> needs
          to be run first.
        </p>
        <Link href={`/${slug}/think-tank/${ideaId}`} className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
          ← Back to idea
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link href={`/${slug}/think-tank/${ideaId}`} className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Back to idea
          </Link>
          <h1 className="text-lg font-semibold text-neutral-900 mt-1">{idea.title} — Canvas</h1>
        </div>
        {idea.linked_project_id && (
          <Link
            href={`/${slug}/think-tank/${ideaId}`}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            This idea is already converted — canvas is now historical context →
          </Link>
        )}
      </div>
      <IdeaCanvasBoard slug={slug} ideaId={ideaId} ideaTitle={idea.title} initialNodes={nodes} initialEdges={edges} />
    </div>
  );
}
