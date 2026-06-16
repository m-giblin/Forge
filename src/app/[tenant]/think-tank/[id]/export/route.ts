import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ideasRepo, ideaCommentsRepo, ideaAiTurnsRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  const { tenant: slug, id } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const [idea, comments, aiTurns] = await Promise.all([
    ideasRepo(supabase).getById(ctx.tenant.id, id),
    ideaCommentsRepo(supabase).list(ctx.tenant.id, id),
    ideaAiTurnsRepo(supabase).listRecent(ctx.tenant.id, id, 10),
  ]);

  if (!idea) return new NextResponse("Not found", { status: 404 });

  const lines: string[] = [];

  lines.push(`# ${idea.title}`);
  lines.push("");
  lines.push(`**Status:** ${idea.status}`);
  if (idea.tags.length > 0) lines.push(`**Tags:** ${idea.tags.join(", ")}`);
  if (idea.review_by) lines.push(`**Review by:** ${idea.review_by}`);
  lines.push(`**Exported:** ${new Date().toLocaleDateString()}`);
  lines.push("");

  if (idea.description) {
    lines.push("## Description");
    lines.push("");
    lines.push(idea.description);
    lines.push("");
  }

  const topLevel = comments.filter((c) => !c.isDeleted && !c.parentId);
  if (topLevel.length > 0) {
    lines.push("## Discussion");
    lines.push("");
    for (const c of topLevel) {
      const author = c.authorName ?? "Unknown";
      const date = new Date(c.createdAt).toLocaleDateString();
      lines.push(`**${author}** _(${date})_`);
      lines.push("");
      lines.push(c.body);
      lines.push("");
      const replies = comments.filter((r) => r.parentId === c.id && !r.isDeleted);
      for (const r of replies) {
        const ra = r.authorName ?? "Unknown";
        const rd = new Date(r.createdAt).toLocaleDateString();
        lines.push(`> **${ra}** _(${rd})_: ${r.body.replace(/\n/g, " ")}`);
        lines.push("");
      }
    }
  }

  if (aiTurns.length > 0) {
    lines.push("## AI Sounding Board");
    lines.push("");
    for (const turn of aiTurns) {
      const date = new Date(turn.createdAt).toLocaleDateString();
      if (turn.pills.length > 0) {
        lines.push(`**Lenses:** ${turn.pills.join(", ")} _(${date})_`);
      }
      if (turn.userInput) {
        lines.push("");
        lines.push(`**Question:** ${turn.userInput}`);
      }
      lines.push("");
      lines.push(turn.aiResponse);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  const markdown = lines.join("\n");
  const slug_ = idea.title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug_}.md"`,
    },
  });
}
