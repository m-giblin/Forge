"use client";

import { useState, useTransition } from "react";
import { saveIssueSpecAction } from "./actions";

export function IssueSpecPanel({
  slug,
  issueId,
  initialSpec,
  readOnly,
  hideLabel,
}: {
  slug: string;
  issueId: string;
  initialSpec: string | null;
  readOnly: boolean;
  /** Suppress the "Spec / PRD" label — used when an outer collapsible section already shows it. */
  hideLabel?: boolean;
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
        {!hideLabel && <p className="text-xs font-semibold uppercase tracking-wide text-[#a19d90]">Spec / PRD</p>}
        {!readOnly && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#a19d90] hover:text-[#4a473e]"
          >
            {value ? "Edit" : "+ Add spec"}
          </button>
        )}
        {saved && <span className="text-xs text-[#3f7d4c]">Saved ✓</span>}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write acceptance criteria, requirements, or a mini-PRD in Markdown…"
            rows={12}
            className="w-full rounded-lg border border-[#ddd8c9] bg-white px-3 py-2 text-sm font-mono text-[#20201d] outline-none focus:border-[#b7452f] focus:ring-1 focus:ring-[#b7452f] resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#f2e9d8] disabled:opacity-50"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancel}
              className="rounded-lg border border-[#ddd8c9] px-3 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : value ? (
        <SpecPreview markdown={value} />
      ) : (
        <p className="text-xs text-[#a19d90] italic">
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
    <div className="prose prose-sm max-w-none text-[#4a473e]">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="text-xs font-bold mt-3 mb-1 text-[#20201d]">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-bold mt-3 mb-1 text-[#20201d]">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-base font-bold mt-3 mb-1 text-[#20201d]">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <div key={i} className="flex gap-1.5 text-xs"><span className="shrink-0 mt-0.5 text-[#a19d90]">•</span><span>{renderInline(line.slice(2))}</span></div>;
        if (line.startsWith("```")) return <div key={i} />;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-xs text-[#4a473e] my-0.5">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** and inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-[#f4f2eb] px-1 font-mono text-[10px] text-[#20201d]">{p.slice(1, -1)}</code>;
    return p;
  });
}
