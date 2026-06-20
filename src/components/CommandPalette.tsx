"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ResultItem =
  | { kind: "issue"; id: string; key: string; title: string; status: string; priority: string }
  | { kind: "nav"; label: string; href: string; icon: string }
  | { kind: "action"; label: string; icon: string; onSelect: () => void };

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-green-400",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export default function CommandPalette({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Global Cmd-K / Ctrl-K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Build results whenever query changes
  useEffect(() => {
    const q = query.trim().toLowerCase();

    const navItems: Extract<ResultItem, { kind: "nav" }>[] = [
      { kind: "nav", label: "Board", href: `/${slug}/board`, icon: "⬜" },
      { kind: "nav", label: "Issues", href: `/${slug}/issues`, icon: "🐛" },
      { kind: "nav", label: "Projects", href: `/${slug}/projects`, icon: "📁" },
      { kind: "nav", label: "Members", href: `/${slug}/members`, icon: "👥" },
      { kind: "nav", label: "Settings", href: `/${slug}/settings`, icon: "⚙️" },
    ];

    if (!q) {
      setResults(navItems);
      setSelected(0);
      return;
    }

    // Filter nav
    const filteredNav = navItems.filter((n) => n.label.toLowerCase().includes(q));

    // Search issues via API
    startSearch(async () => {
      try {
        const res = await fetch(`/api/search?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json();
        const issues: ResultItem[] = (json.data ?? []).map((i: Record<string, string>) => ({
          kind: "issue" as const,
          id: i.id,
          key: i.key ?? `#${i.number}`,
          title: i.title,
          status: i.status,
          priority: i.priority,
        }));
        setResults([...filteredNav, ...issues]);
        setSelected(0);
      } catch {
        setResults(filteredNav);
        setSelected(0);
      }
    });
  }, [query, slug]);

  function selectItem(item: ResultItem) {
    if (item.kind === "nav") {
      router.push(item.href);
    } else if (item.kind === "issue") {
      router.push(`/${slug}/issues/${item.id}`);
    } else if (item.kind === "action") {
      item.onSelect();
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      selectItem(results[selected]);
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
          <span className="text-neutral-400">
            {searching ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/>
              </svg>
            )}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search issues, navigate…"
            className="flex-1 bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {results.map((item, i) => (
              <li
                key={i}
                onClick={() => selectItem(item)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  i === selected ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                {item.kind === "issue" ? (
                  <>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] ?? "bg-neutral-300"}`} />
                    <span className="font-mono text-xs text-neutral-400 shrink-0">{item.key}</span>
                    <span className="flex-1 truncate text-neutral-800">{item.title}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{STATUS_LABEL[item.status] ?? item.status}</span>
                  </>
                ) : item.kind === "nav" ? (
                  <>
                    <span className="shrink-0 text-base">{item.icon}</span>
                    <span className="flex-1 text-neutral-800">{item.label}</span>
                    <span className="shrink-0 text-xs text-neutral-400">Go to</span>
                  </>
                ) : (
                  <>
                    <span className="shrink-0 text-base">{item.icon}</span>
                    <span className="flex-1 text-neutral-800">{item.label}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {results.length === 0 && query.trim() && !searching && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">No results for &ldquo;{query}&rdquo;</p>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> select</span>
          <span><kbd className="font-sans">esc</kbd> close</span>
          <span className="ml-auto"><kbd className="font-sans">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
