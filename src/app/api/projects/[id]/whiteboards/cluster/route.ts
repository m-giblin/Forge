import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { grokComplete } from "@/lib/services/grokAi";

interface StickyInput {
  id: string;
  text: string;
}

interface ClusterGroup {
  name: string;
  stickyIds: string[];
}

async function callGrok(tenantId: string, stickies: StickyInput[]): Promise<ClusterGroup[]> {
  const stickyList = stickies.map((s, i) => `[${i + 1}] id="${s.id}": ${s.text}`).join("\n");

  const text = await grokComplete(tenantId, [
    {
      role: "system",
      content: `You are a workshop facilitator helping a product team cluster sticky notes into named themes.
Return ONLY a JSON array. No prose. No markdown. Just raw JSON.
Format: [{"name":"<short group label>","stickyIds":["<id1>","<id2>"]}]
Rules:
- Group semantically related stickies together
- 2-6 groups depending on how many stickies there are
- Each group name is 2-5 words, title case
- Every sticky must appear in exactly one group
- stickyIds must match the ids from the input exactly`,
    },
    {
      role: "user",
      content: `Cluster these sticky notes into named themes:\n\n${stickyList}`,
    },
  ], { temperature: 0.3, maxTokens: 800, feature: "whiteboard_cluster" });

  // Strip markdown code fences if Grok wraps it
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean || "[]") as ClusterGroup[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const stickies: StickyInput[] = body?.stickies ?? [];

  if (stickies.length < 2) {
    return NextResponse.json({ error: "Select at least 2 sticky notes to cluster" }, { status: 400 });
  }
  if (stickies.length > 40) {
    return NextResponse.json({ error: "Maximum 40 stickies per cluster operation" }, { status: 400 });
  }

  // Validate input — no injection: stickies are user whiteboard content, not commands
  const sanitized = stickies.map((s) => ({
    id: String(s.id).slice(0, 200),
    text: String(s.text ?? "").slice(0, 500),
  }));

  try {
    const groups = await callGrok(ctx.tenant.id, sanitized);
    return NextResponse.json({ groups });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI clustering failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
