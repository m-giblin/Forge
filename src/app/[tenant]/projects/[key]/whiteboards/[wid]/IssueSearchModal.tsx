"use client";

import { useEffect, useRef, useState } from "react";

interface Issue {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-neutral-200 text-neutral-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
  backlog: "bg-neutral-100 text-neutral-500",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  backlog: "Backlog",
};

interface Props {
  projectKey: string;
  onSelect: (issue: Issue) => void;
  onClose: () => void;
}

export default function IssueSearchModal({ projectKey, onSelect, onClose }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ project: projectKey, limit: "20" });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/v1/issues?${params}`);
        const json = await res.json();
        setResults((json.data ?? []).map((i: { id: string; key: string; title: string; status: string; priority: string }) => ({
          id: i.id, key: i.key, title: i.title, status: i.status, priority: i.priority,
        })));
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [q, projectKey]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800">Link to Issue</p>
        </div>
        <div className="p-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or key…"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <div className="max-h-72 overflow-y-auto px-2 pb-2">
          {loading && <p className="py-4 text-center text-sm text-neutral-400">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral-400">No issues found</p>
          )}
          {results.map((issue) => (
            <button
              key={issue.id}
              onClick={() => onSelect(issue)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50 transition"
            >
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">{issue.key}</span>
              <span className="flex-1 min-w-0 text-sm text-neutral-800 truncate">{issue.title}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[issue.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                {STATUS_LABELS[issue.status] ?? issue.status}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-neutral-100 px-4 py-2.5 flex justify-end">
          <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}
