"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { IssueLinkWithKey } from "@/lib/repositories/issueLinks";
import {
  addIssueLinkAction,
  removeIssueLinkAction,
  createSubIssueAction,
  setParentIssueAction,
} from "./issueHierarchyActions";

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold cursor-default select-none leading-none group-hover/tip:bg-neutral-300">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded-lg bg-neutral-900 px-3 py-2 text-[11px] text-white leading-relaxed shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
      </span>
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SearchResult = { id: string; key: string; title: string; status: string; priority: string };

const STATUS_DOT: Record<string, string> = {
  done:        "bg-emerald-500",
  in_review:   "bg-blue-400",
  in_progress: "bg-amber-400",
};
function statusDot(s: string) { return STATUS_DOT[s] ?? "bg-neutral-300"; }

const PRIORITY_ICON: Record<string, string> = {
  urgent: "🔴", high: "🟠", medium: "🟡", low: "🔵",
};

// ── Shared typeahead picker ────────────────────────────────────────────────────

function IssueSearchPicker({
  slug,
  placeholder,
  excludeId,
  excludeIds = [],
  onSelect,
  onCancel,
}: {
  slug: string;
  placeholder?: string;
  excludeId?: string;
  excludeIds?: string[];
  onSelect: (result: SearchResult) => void;
  onCancel: () => void;
}) {
  const [q, setQ]               = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(true);
  const [highlight, setHighlight] = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (text: string) => {
    if (!text.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: text });
      if (excludeId) params.set("exclude", excludeId);
      if (excludeIds.length) params.set("excludeIds", excludeIds.join(","));
      const res = await fetch(`/${slug}/issues/search?${params}`);
      const json = await res.json() as { results?: SearchResult[] };
      setResults(json.results ?? []);
      setHighlight(0);
    } finally {
      setLoading(false);
    }
  }, [slug, excludeId, excludeIds]);

  function handleChange(val: string) {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 180);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown")  { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp")    { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && results[highlight]) { e.preventDefault(); onSelect(results[highlight]!); }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 focus-within:border-neutral-900">
        <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder ?? "Search issues by title or key…"}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
        />
        {loading && <span className="text-[10px] text-neutral-400">…</span>}
      </div>

      {focused && (results.length > 0 || (q.length > 1 && !loading)) && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-neutral-400">No matching issues found</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={() => onSelect(r)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${i === highlight ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(r.status)}`} />
                    <span className="font-mono text-[11px] text-neutral-400 shrink-0">{r.key}</span>
                    <span className="text-xs text-neutral-800 truncate flex-1">{r.title}</span>
                    <span className="text-[11px] shrink-0">{PRIORITY_ICON[r.priority] ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Link type selector ─────────────────────────────────────────────────────────

type LinkType = "duplicates" | "blocks";

const LINK_TYPES: { value: LinkType; label: string; desc: string }[] = [
  { value: "duplicates", label: "Duplicate",  desc: "Same problem as another issue" },
  { value: "blocks",     label: "Blocks",     desc: "This must be resolved first" },
];

// ── LinkedIssuesCard ──────────────────────────────────────────────────────────

const LINK_DISPLAY: Record<string, { out: string; inv: string; color: string }> = {
  duplicates: { out: "duplicates",    inv: "duplicated by", color: "text-orange-600" },
  blocks:     { out: "blocks",        inv: "blocked by",    color: "text-red-600" },
  relates_to: { out: "relates to",    inv: "relates to",    color: "text-neutral-500" },
};

export function LinkedIssuesCard({
  slug,
  issueId,
  links,
  readOnly,
  tooltip,
}: {
  slug: string;
  issueId: string;
  links: IssueLinkWithKey[];
  readOnly: boolean;
  tooltip?: string;
}) {
  const [adding, setAdding]         = useState(false);
  const [linkType, setLinkType]     = useState<LinkType>("duplicates");
  const [error, setError]           = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();

  const alreadyLinkedIds = links.map((l) =>
    l.direction === "outbound" ? l.targetIssueId : l.sourceIssueId
  );

  const openBlockers = links.filter(
    (l) => l.linkType === "blocks" && l.direction === "inbound" && l.targetStatus !== "done"
  );

  function handleSelect(result: SearchResult) {
    setError(null);
    startTransition(async () => {
      try {
        await addIssueLinkAction(slug, issueId, result.id, linkType);
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to link");
      }
    });
  }

  function removeLink(linkId: string) {
    startTransition(() => removeIssueLinkAction(slug, linkId, issueId));
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${openBlockers.length > 0 ? "border-red-300" : "border-neutral-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 flex items-center gap-2">
          Linked issues {links.length > 0 && `(${links.length})`}
          {tooltip && <InfoTip text={tooltip} />}
          {openBlockers.length > 0 && (
            <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
              🚫 Blocked
            </span>
          )}
        </p>
        {!readOnly && (
          <button onClick={() => { setAdding((s) => !s); setError(null); }}
            className="text-xs text-neutral-400 hover:text-neutral-700">
            {adding ? "Cancel" : "+ Link issue"}
          </button>
        )}
      </div>

      {/* Add link form */}
      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          {/* Relationship type toggle */}
          <div className="flex gap-1.5">
            {LINK_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setLinkType(t.value)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-left transition ${
                  linkType === t.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                }`}>
                <div className="text-xs font-medium">{t.label}</div>
                <div className={`text-[10px] leading-tight ${linkType === t.value ? "text-neutral-300" : "text-neutral-400"}`}>{t.desc}</div>
              </button>
            ))}
          </div>

          <IssueSearchPicker
            slug={slug}
            placeholder="Search by title or key (e.g. WEB-12)…"
            excludeId={issueId}
            excludeIds={alreadyLinkedIds}
            onSelect={handleSelect}
            onCancel={() => setAdding(false)}
          />
          {pending && <p className="text-xs text-neutral-400">Linking…</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* Existing links */}
      {links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((l) => {
            const meta = LINK_DISPLAY[l.linkType] ?? LINK_DISPLAY.relates_to;
            const label = l.direction === "outbound" ? meta!.out : meta!.inv;
            const linkedId = l.direction === "outbound" ? l.targetIssueId : l.sourceIssueId;
            return (
              <li key={l.id} className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(l.targetStatus)}`} />
                <span className={`text-[11px] shrink-0 font-medium ${meta!.color}`}>{label}</span>
                <Link href={`/${slug}/issues/${linkedId}`}
                  className="text-xs text-neutral-700 hover:text-neutral-900 truncate flex-1">
                  <span className="font-mono text-neutral-400 mr-1">{l.targetKey}</span>
                  {l.targetTitle}
                </Link>
                {!readOnly && (
                  <button onClick={() => removeLink(l.id)} disabled={pending}
                    title="Remove link"
                    className="flex-shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {links.length === 0 && !adding && (
        <p className="text-xs text-neutral-400">No linked issues yet.</p>
      )}
    </div>
  );
}

// ── SubIssuesCard ─────────────────────────────────────────────────────────────

export function SubIssuesCard({
  slug,
  parentIssueId,
  projectId,
  projectKey,
  subIssues,
  readOnly,
  tooltip,
}: {
  slug: string;
  parentIssueId: string;
  projectId: string;
  projectKey: string;
  subIssues: { id: string; number: number; title: string; status: string; priority: string }[];
  readOnly: boolean;
  tooltip?: string;
}) {
  const [mode, setMode]             = useState<null | "new" | "existing">(null);
  const [title, setTitle]           = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();

  const done = subIssues.filter((i) => i.status === "done").length;
  const existingIds = subIssues.map((i) => i.id);

  function submitNew() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createSubIssueAction(slug, parentIssueId, projectId, title);
        setTitle("");
        setMode(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleSelectExisting(result: SearchResult) {
    setError(null);
    startTransition(async () => {
      try {
        await setParentIssueAction(slug, result.id, parentIssueId);
        setMode(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 flex items-center gap-1.5">
          Sub-issues{subIssues.length > 0 && <span className="font-normal">({done}/{subIssues.length} done)</span>}
          {tooltip && <InfoTip text={tooltip} />}
        </p>
        {!readOnly && !mode && (
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("existing")}
              className="text-xs text-neutral-400 hover:text-neutral-700">Link existing</button>
            <button onClick={() => setMode("new")}
              className="text-xs text-neutral-400 hover:text-neutral-700">+ New</button>
          </div>
        )}
        {mode && (
          <button onClick={() => { setMode(null); setTitle(""); setError(null); }}
            className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
        )}
      </div>

      {/* Progress bar */}
      {subIssues.length > 0 && (
        <div className="mb-2 h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${subIssues.length ? (done / subIssues.length) * 100 : 0}%` }} />
        </div>
      )}

      {/* Existing sub-issues */}
      {subIssues.length > 0 && (
        <ul className="space-y-1 mb-2">
          {subIssues.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(i.status)}`} />
              <Link href={`/${slug}/issues/${i.id}`}
                className="text-xs text-neutral-700 hover:text-neutral-900 truncate flex-1">
                <span className="font-mono text-neutral-400 mr-1">{projectKey}-{i.number}</span>
                {i.title}
              </Link>
              <span className="text-[10px] shrink-0">{PRIORITY_ICON[i.priority] ?? ""}</span>
              {!readOnly && (
                <button
                  onClick={() => startTransition(() => setParentIssueAction(slug, i.id, null))}
                  disabled={pending}
                  title="Remove sub-issue"
                  className="flex-shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {subIssues.length === 0 && !mode && (
        <p className="text-xs text-neutral-400">No sub-issues yet.</p>
      )}

      {/* Add: new issue */}
      {mode === "new" && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") setMode(null); }}
            placeholder="Sub-issue title…" disabled={pending}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 disabled:opacity-50" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={submitNew} disabled={pending || !title.trim()}
            className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-neutral-700">
            {pending ? "Creating…" : "Create sub-issue"}
          </button>
        </div>
      )}

      {/* Add: link existing */}
      {mode === "existing" && (
        <div className="mt-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          <p className="mb-2 text-[11px] text-neutral-500">Search for an issue to make it a sub-issue of this one:</p>
          <IssueSearchPicker
            slug={slug}
            placeholder="Search by title or key…"
            excludeId={parentIssueId}
            excludeIds={existingIds}
            onSelect={handleSelectExisting}
            onCancel={() => setMode(null)}
          />
          {pending && <p className="mt-1.5 text-xs text-neutral-400">Linking…</p>}
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
