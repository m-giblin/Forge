"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { markDuplicateAction } from "./actions";

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip ml-1">
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

export default function MarkDuplicateButton({
  slug,
  issueId,
  currentStatus,
  readOnly,
  tooltip,
}: {
  slug: string;
  issueId: string;
  currentStatus: string;
  readOnly: boolean;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; key: string; title: string }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(currentStatus === "done");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      const res = await fetch(`/api/search?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(query)}&limit=6`);
      const json = await res.json();
      setResults(
        (json.data ?? [])
          .filter((i: { id: string }) => i.id !== issueId)
          .map((i: { id: string; key?: string; number?: string; title: string }) => ({
            id: i.id,
            key: i.key ?? `#${i.number}`,
            title: i.title,
          }))
      );
    }, query.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [query, slug, issueId]);

  function pick(canonical: { id: string; key: string }) {
    if (!confirm(`Mark this issue as a duplicate of ${canonical.key} and close it?`)) return;
    startTransition(async () => {
      await markDuplicateAction(slug, issueId, canonical.id, canonical.key);
      setDone(true);
      setOpen(false);
    });
  }

  if (readOnly || done) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 flex items-center gap-1.5">
          Duplicate
          {tooltip && <InfoTip text={tooltip} />}
        </p>
      </div>
      <p className="text-xs text-neutral-400 mb-3">
        Mark this issue as a duplicate of another and close it.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors text-left"
        >
          🔁 Mark as duplicate of…
        </button>
      ) : (
        <div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Search for the original issue…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />

          {results.length > 0 && (
            <ul className="mt-1 rounded-lg border border-neutral-200 bg-white shadow-md overflow-hidden">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => pick(r)}
                    disabled={isPending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    <span className="font-mono text-neutral-400 shrink-0">{r.key}</span>
                    <span className="truncate text-neutral-800">{r.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setOpen(false)}
            className="mt-2 text-xs text-neutral-400 hover:text-neutral-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
