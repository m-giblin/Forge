"use client";

import { useState, useEffect, useTransition } from "react";
import type { TriageSuggestion } from "@/lib/repositories/issues";
import type { IssueComment } from "@/lib/repositories/issueActivity";
import { runTriageAction, acceptTriageAction, dismissTriageAction } from "./triageActions";
import { markDuplicateAction } from "./actions";

export default function TriageCard({
  slug,
  issueId,
  suggestion,
  readOnly,
  inline = false,
  onCommentAdded,
}: {
  slug: string;
  issueId: string;
  suggestion: TriageSuggestion | null | undefined;
  readOnly: boolean;
  inline?: boolean;
  onCommentAdded?: (comment: IssueComment) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [ageLabel, setAgeLabel] = useState("");
  useEffect(() => {
    if (!suggestion?.generatedAt) return;
    const age = Math.round((Date.now() - new Date(suggestion.generatedAt).getTime()) / 60000);
    setAgeLabel(age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`); // eslint-disable-line react-hooks/set-state-in-effect
  }, [suggestion?.generatedAt]);

  if (dismissed) return null;

  function runTriage() {
    startTransition(() => runTriageAction(slug, issueId));
  }

  function accept() {
    if (!suggestion) return;
    startTransition(async () => {
      const comment = await acceptTriageAction(slug, issueId, {
        priority: suggestion.priority,
        categoryLabel: suggestion.categoryLabel,
        reasoning: suggestion.reasoning,
      });
      onCommentAdded?.(comment);
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissTriageAction(slug, issueId);
      setDismissed(true);
    });
  }

  // Inline mode: just the trigger button (used inside AI Actions group)
  if (!suggestion) {
    if (readOnly) return null;
    return (
      <button
        onClick={runTriage}
        disabled={pending}
        className="w-full flex items-center gap-3 rounded-lg border border-[#ddd8c9] bg-white px-3 py-2.5 text-left hover:border-[#b7452f]/50 hover:bg-[#f4f2eb] transition disabled:opacity-50"
      >
        <span className="text-lg">🔍</span>
        <div>
          <p className="text-sm font-medium text-[#20201d]">{pending ? "Analyzing…" : "Triage Issue"}</p>
          <p className="text-xs text-[#a19d90]">Auto-classify priority & category</p>
        </div>
      </button>
    );
  }

  // Suggestion available — show results card (full width, below the action buttons)
  return (
    <div className={inline ? "rounded-lg border border-[#ddd8c9] bg-white p-3 space-y-2" : "fw-card rounded-xl p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#b7452f]">✨ Triage Result</p>
        <span className="text-[11px] text-[#a19d90]">{ageLabel}</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#726e60] shrink-0 w-20">Priority</span>
          <span className="font-medium text-[#20201d] capitalize">{suggestion.priority}</span>
        </div>
        {suggestion.categoryLabel && (
          <div className="flex items-center gap-2">
            <span className="text-[#726e60] shrink-0 w-20">Category</span>
            <span className="font-medium text-[#20201d]">{suggestion.categoryLabel}</span>
          </div>
        )}
        {(suggestion.duplicateCandidates ?? []).length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[#726e60] shrink-0 w-20 pt-0.5">Possible dup</span>
            <ul className="space-y-1">
              {(suggestion.duplicateCandidates ?? []).map((d) => (
                <li key={d.id} className="flex items-center gap-1.5">
                  <span className="text-[#c9791d] truncate max-w-[120px] text-xs" title={d.title}>
                    ⚠ #{d.number} {d.title}
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => startTransition(() => markDuplicateAction(slug, issueId, d.id, `#${d.number}`))}
                      disabled={pending}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[#fdf1de] text-[#c9791d] hover:bg-[#f3ddb8] border border-[#f3ddb8] whitespace-nowrap disabled:opacity-50"
                    >
                      Mark dup
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[#726e60] leading-relaxed pt-1 border-t border-[#ddd8c9]">
          {suggestion.reasoning}
        </p>
      </div>

      {!readOnly && (
        <div className="flex gap-2 pt-1">
          <button onClick={accept} disabled={pending}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[#f2e9d8] disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}>
            {pending ? "Applying…" : "Accept"}
          </button>
          <button onClick={runTriage} disabled={pending}
            className="rounded-lg border border-[#ddd8c9] px-3 py-1.5 text-xs text-[#b7452f] hover:bg-[#f4f2eb] disabled:opacity-50">
            Re-analyze
          </button>
          <button onClick={dismiss} disabled={pending}
            className="rounded-lg border border-[#ddd8c9] px-3 py-1.5 text-xs text-[#726e60] hover:bg-[#f4f2eb] disabled:opacity-50">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
