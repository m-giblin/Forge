import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOC_GUIDES, type DocSection } from "@/app/[tenant]/docs/content";
import { grokComplete } from "@/lib/services/grokAi";

export type EmberRole = "owner" | "admin" | "member" | "viewer";

export type EmberSource =
  | { kind: "doc"; guideTitle: string; sectionId: string; sectionTitle: string }
  | { kind: "wiki"; spaceId: string; pageId: string; pageTitle: string };

export type EmberAnswer = {
  answer: string;
  sources: EmberSource[];
};

const STOPWORDS = new Set([
  "the", "a", "an", "to", "in", "on", "of", "for", "and", "or", "is", "are", "how", "do", "i", "can",
  "what", "does", "my", "me", "it", "this", "that", "with", "you", "your", "be", "was", "were",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function sectionText(section: DocSection): string {
  return [
    section.title,
    section.description,
    section.overview,
    ...section.steps.map((s) => `${s.title} ${s.description}`),
    ...(section.commonIssues ?? []).map((c) => `${c.problem} ${c.fix}`),
  ].join(" ");
}

/**
 * Cheap keyword-overlap retrieval over the (small, finite) Docs Hub corpus —
 * no vector DB needed at this size. Scoped by role exactly like the Docs Hub
 * UI itself, so Ember never surfaces a section the asking user couldn't
 * already read by clicking around manually.
 */
export function retrieveRelevantSections(question: string, role: EmberRole, limit = 4): (DocSection & { guideTitle: string })[] {
  const qWords = new Set(tokenize(question));
  if (qWords.size === 0) return [];

  const scored: { section: DocSection & { guideTitle: string }; score: number }[] = [];
  for (const guide of DOC_GUIDES) {
    for (const section of guide.sections) {
      if (!section.roles.includes(role)) continue;
      const words = tokenize(sectionText(section));
      let score = 0;
      for (const w of words) if (qWords.has(w)) score++;
      if (score > 0) scored.push({ section: { ...section, guideTitle: guide.title }, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.section);
}

function formatSectionForPrompt(section: DocSection & { guideTitle: string }): string {
  const steps = section.steps.map((s) => `  ${s.step}. ${s.title} — ${s.description}${s.tip ? ` (Tip: ${s.tip})` : ""}`).join("\n");
  const issues = (section.commonIssues ?? [])
    .map((c) => `  - Problem: ${c.problem} → Fix: ${c.fix}`)
    .join("\n");
  return `### [Forge product docs] ${section.guideTitle} — ${section.title}\n${section.overview}\n${steps}${issues ? `\nCommon issues:\n${issues}` : ""}`;
}

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] };

/** Pages store body as Tiptap JSON (as text), not plain text or HTML — walk the
 * tree and pull out just the human-readable words for the LLM prompt. */
function extractTiptapText(rawBody: string): string {
  let doc: TiptapNode;
  try {
    doc = JSON.parse(rawBody) as TiptapNode;
  } catch {
    return "";
  }
  const parts: string[] = [];
  (function walk(node: TiptapNode) {
    if (typeof node.text === "string") parts.push(node.text);
    node.content?.forEach(walk);
  })(doc);
  return parts.join(" ");
}

type WikiCandidate = { spaceId: string; pageId: string; title: string; text: string };

/**
 * Keyword-overlap retrieval over Spaces/Wiki pages — mirrors the Docs Hub
 * retrieval above, but the corpus is per-tenant user content rather than
 * static product docs. Access filtering matches /api/spaces/pages/search
 * exactly (personal spaces are owner-only; team/project spaces are visible
 * tenant-wide, same as the existing Wiki search UI) so Ember never has
 * broader read access than the Wiki search box a user could type into
 * themselves. Full title+body text is scored (the existing search endpoint
 * only indexes titles) since an assistant answering from a page needs its
 * actual content, not just whether the title matched.
 */
async function retrieveRelevantWikiPages(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  question: string,
  limit = 3
): Promise<WikiCandidate[]> {
  const qWords = new Set(tokenize(question));
  if (qWords.size === 0) return [];

  const { data, error } = await supabase
    .from("pages")
    .select("id, space_id, title, body, spaces(id, type, owner_id)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(500);
  if (error || !data) return [];

  const scored: { candidate: WikiCandidate; score: number }[] = [];
  for (const row of data) {
    const space = (Array.isArray(row.spaces) ? row.spaces[0] : row.spaces) as
      | { id: string; type: string; owner_id: string | null }
      | null;
    if (!space) continue;
    if (space.type === "personal" && space.owner_id !== userId) continue;

    const bodyText = extractTiptapText(row.body as string);
    const words = tokenize(`${row.title as string} ${bodyText}`);
    let score = 0;
    for (const w of words) if (qWords.has(w)) score++;
    if (score > 0) {
      scored.push({
        candidate: { spaceId: space.id, pageId: row.id as string, title: row.title as string, text: bodyText.slice(0, 1200) },
        score,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.candidate);
}

function formatWikiForPrompt(page: WikiCandidate): string {
  return `### [Team wiki] ${page.title}\n${page.text}`;
}

/**
 * Answers a question grounded in the Docs Hub (Forge's own product docs) and
 * this tenant's Spaces/Wiki content (the team's own process knowledge) —
 * never anything from another tenant, and never a Wiki page the asking user
 * couldn't already open themselves. No write access yet (Phase 3).
 */
export async function askEmber(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  question: string,
  role: EmberRole
): Promise<EmberAnswer> {
  const [sections, wikiPages] = await Promise.all([
    Promise.resolve(retrieveRelevantSections(question, role)),
    retrieveRelevantWikiPages(supabase, tenantId, userId, question),
  ]);

  if (sections.length === 0 && wikiPages.length === 0) {
    return {
      answer:
        "I couldn't find anything in the docs or your team's wiki about that. Try rephrasing, or browse the Docs Hub or Spaces directly.",
      sources: [],
    };
  }

  const context = [...sections.map(formatSectionForPrompt), ...wikiPages.map(formatWikiForPrompt)].join("\n\n");
  const prompt = `You are Ember, the in-app help assistant for Forge (a project-management tool). Answer the user's question using ONLY the excerpts below — do not invent features, menu paths, or behavior that isn't stated. Excerpts marked [Forge product docs] describe how Forge itself works; excerpts marked [Team wiki] are this team's own notes and may describe their process, not Forge's. Distinguish the two when relevant. If the excerpts don't fully answer the question, say what's missing rather than guessing. Keep the answer under 150 words and reference which source(s) you drew from by name.

EXCERPTS:
${context}

QUESTION: ${question}`;

  const answer = await grokComplete(tenantId, prompt, {
    feature: "ember_assistant",
    temperature: 0.2,
    maxTokens: 400,
  });

  return {
    answer,
    sources: [
      ...sections.map((s): EmberSource => ({ kind: "doc", guideTitle: s.guideTitle, sectionId: s.id, sectionTitle: s.title })),
      ...wikiPages.map((p): EmberSource => ({ kind: "wiki", spaceId: p.spaceId, pageId: p.pageId, pageTitle: p.title })),
    ],
  };
}
