import "server-only";
import { DOC_GUIDES, type DocSection } from "@/app/[tenant]/docs/content";
import { grokComplete } from "@/lib/services/grokAi";

export type EmberRole = "owner" | "admin" | "member" | "viewer";

export type EmberSource = {
  guideTitle: string;
  sectionId: string;
  sectionTitle: string;
};

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
  return `### ${section.guideTitle} — ${section.title}\n${section.overview}\n${steps}${issues ? `\nCommon issues:\n${issues}` : ""}`;
}

/**
 * Answers a product question grounded ONLY in the Docs Hub sections visible
 * to this user's role — no write access, no other data sources (Phase 1).
 * Returns the sections used so the UI can link straight to them, which is
 * both a trust signal and a cheap hallucination check: every claim should
 * be traceable to a cited section.
 */
export async function askEmber(tenantId: string, question: string, role: EmberRole): Promise<EmberAnswer> {
  const sections = retrieveRelevantSections(question, role);

  if (sections.length === 0) {
    return {
      answer:
        "I couldn't find anything in the docs about that. Try rephrasing, or browse the Docs Hub directly — I can only answer from what's written there today.",
      sources: [],
    };
  }

  const context = sections.map(formatSectionForPrompt).join("\n\n");
  const prompt = `You are Ember, the in-app help assistant for Forge (a project-management tool). Answer the user's question using ONLY the documentation excerpts below — do not invent features, menu paths, or behavior that isn't stated. If the excerpts don't fully answer the question, say what's missing rather than guessing. Keep the answer under 150 words and reference which guide section(s) you drew from by name.

DOCUMENTATION EXCERPTS:
${context}

QUESTION: ${question}`;

  const answer = await grokComplete(tenantId, prompt, {
    feature: "ember_assistant",
    temperature: 0.2,
    maxTokens: 400,
  });

  return {
    answer,
    sources: sections.map((s) => ({ guideTitle: s.guideTitle, sectionId: s.id, sectionTitle: s.title })),
  };
}
