"use client";

import { useState, useTransition } from "react";
import { saveIssueSpecAction } from "./actions";

export function IssueSpecPanel({
  slug,
  issueId,
  initialSpec,
  readOnly,
}: {
  slug: string;
  issueId: string;
  initialSpec: string | null;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialSpec ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await saveIssueSpecAction(slug, issueId, value);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function cancel() {
    setValue(initialSpec ?? "");
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Spec / PRD</p>
        {!readOnly && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            {value ? "Edit" : "+ Add spec"}
          </button>
        )}
        {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write acceptance criteria, requirements, or a mini-PRD in Markdown…"
            rows={12}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-neutral-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancel}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : value ? (
        <SpecPreview markdown={value} />
      ) : (
        <p className="text-xs text-neutral-400 italic">
          No spec yet.{!readOnly && " Click \"+ Add spec\" to write acceptance criteria or a mini-PRD."}
        </p>
      )}
    </div>
  );
}

/** Minimal Markdown renderer — bold, italic, headings, bullets, code. No dep. */
function SpecPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");

  return (
    <div className="prose prose-sm max-w-none text-neutral-700">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="text-xs font-bold mt-3 mb-1 text-neutral-900">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-bold mt-3 mb-1 text-neutral-900">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-base font-bold mt-3 mb-1 text-neutral-900">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <div key={i} className="flex gap-1.5 text-xs"><span className="shrink-0 mt-0.5 text-neutral-400">•</span><span>{renderInline(line.slice(2))}</span></div>;
        if (line.startsWith("```")) return <div key={i} />;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-xs text-neutral-700 my-0.5">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** and inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-800">{p.slice(1, -1)}</code>;
    return p;
  });
}
