// Issue-reference parsing for Git integration (Phase 0).
//
// Finds "FORGE-204"-style issue references in a pull request's branch name,
// title, and body so a PR can be linked to the issues it addresses. This is the
// same "magic ref" convention Linear and Jira use.
//
// Pure, side-effect-free, and provider-agnostic — unit-tested in refs.test.ts.
// The webhook handler passes in the tenant's real project keys so a ref only
// links when its KEY is an actual project (kills false positives like "utf-8",
// "base-64", "covid-19").

export type IssueRefSource = "branch" | "title" | "body";

export type ParsedIssueRef = {
  key: string; // project key, e.g. "FORGE"
  number: number; // issue number, e.g. 204
  ref: string; // canonical "FORGE-204"
  sources: IssueRefSource[]; // where it was found (deduped, in priority order)
  isClosing: boolean; // a close/fix/resolve verb pointed at it (drives auto-close)
};

// KEY-NUMBER. Key matches Forge's project-key shape (letter then 1–9 letters/
// digits, upper or lower); number is 1–7 digits. Case is normalised to upper.
const REF_RE = /\b([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,7})\b/g;

// Close keywords (GitHub's set) immediately before a ref mark it as closing.
const CLOSING_RE = /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b/i;

const SOURCE_ORDER: IssueRefSource[] = ["branch", "title", "body"];

/**
 * Parse issue references out of a PR's branch / title / body.
 * Only refs whose key is in `knownKeys` (the tenant's project keys) are returned.
 */
export function parseIssueRefs(
  input: { branch?: string | null; title?: string | null; body?: string | null },
  knownKeys: Iterable<string>
): ParsedIssueRef[] {
  const keySet = new Set<string>();
  for (const k of knownKeys) keySet.add(k.toUpperCase());

  // Accumulate by canonical ref so the same issue cited in several places merges.
  const byRef = new Map<string, ParsedIssueRef>();

  const scan = (text: string | null | undefined, source: IssueRefSource) => {
    if (!text) return;
    for (const m of text.matchAll(REF_RE)) {
      const key = m[1].toUpperCase();
      if (!keySet.has(key)) continue; // not a real project — skip
      const number = Number(m[2]);
      if (!Number.isInteger(number) || number <= 0) continue;
      const ref = `${key}-${number}`;

      // A close verb in the 24 chars before the match (titles/bodies only) flags it.
      const preceding = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
      const closing = source !== "branch" && CLOSING_RE.test(preceding);

      const existing = byRef.get(ref);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        existing.isClosing = existing.isClosing || closing;
      } else {
        byRef.set(ref, { key, number, ref, sources: [source], isClosing: closing });
      }
    }
  };

  // Scan in priority order so `sources` reads branch → title → body.
  scan(input.branch, "branch");
  scan(input.title, "title");
  scan(input.body, "body");

  for (const r of byRef.values()) {
    r.sources.sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b));
  }
  return [...byRef.values()];
}
