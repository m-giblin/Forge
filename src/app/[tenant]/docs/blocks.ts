/**
 * Typed content blocks for real documentation articles — prose, headings,
 * tables, examples, callouts — not just a flat step list. A DocSection can
 * carry `blocks` (this system) alongside or instead of the older `steps`
 * array; DocSectionCard renders blocks when present and falls back to the
 * step-list rendering otherwise, so converting a guide over is additive,
 * not a breaking rewrite of every section at once.
 */

export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "steps"; items: Array<{ title: string; detail: string; tip?: string }> }
  | { type: "tip"; text: string; title?: string }
  | { type: "warning"; text: string; title?: string }
  | { type: "info"; text: string; title?: string }
  | { type: "example"; label: string; scenario: string; outcome?: string }
  | { type: "code"; label?: string; language?: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "feature-grid"; columns?: 2 | 3; items: Array<{ icon: string; name: string; desc: string; badge?: string }> }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "callout"; variant: "info" | "success" | "warning" | "danger"; icon?: string; title: string; text: string }
  | { type: "field-list"; items: Array<{ field: string; type?: string; description: string; example?: string }> }
  | { type: "divider" };

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Flatten blocks to plain text — used by Ember's retrieval/prompt context. */
export function blocksToText(blocks: DocBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return b.text;
        case "heading":
          return b.text;
        case "steps":
          return b.items.map((s) => `${s.title}: ${s.detail}${s.tip ? ` (Tip: ${s.tip})` : ""}`).join("\n");
        case "tip":
          return `Tip: ${b.text}`;
        case "warning":
          return `Warning: ${b.text}`;
        case "info":
          return b.text;
        case "example":
          return `Example (${b.label}): ${b.scenario}${b.outcome ? ` ${b.outcome}` : ""}`;
        case "code":
          return b.code;
        case "table":
          return [b.headers.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n");
        case "feature-grid":
          return b.items.map((i) => `${i.name}: ${i.desc}`).join("\n");
        case "list":
          return b.items.join("\n");
        case "callout":
          return `${b.title}: ${b.text}`;
        case "field-list":
          return b.items.map((i) => `${i.field}: ${i.description}${i.example ? ` (e.g. ${i.example})` : ""}`).join("\n");
        case "divider":
          return "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Extract heading anchors from blocks — used by DocToc. */
export function extractHeadings(blocks: DocBlock[]): Array<{ id: string; text: string; level: 2 | 3 }> {
  return blocks
    .filter((b): b is Extract<DocBlock, { type: "heading" }> => b.type === "heading")
    .map((b) => ({ id: slugify(b.text), text: b.text, level: b.level }));
}
