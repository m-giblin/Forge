"use client";

import { useState, useEffect, useTransition } from "react";
import type { TriageSuggestion } from "@/lib/repositories/issues";
import { runTriageAction, acceptTriageAction, dismissTriageAction } from "./triageActions";
import { markDuplicateAction } from "./actions";

export default function TriageCard({
  slug,
  issueId,
  suggestion,
  readOnly,
  inline = false,
}: {
  slug: string;
  issueId: string;
  suggestion: TriageSuggestion | null | undefined;
  readOnly: boolean;
  inline?: boolean;
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
      await acceptTriageAction(slug, issueId, {
        priority: suggestion.priority,
        categoryLabel: suggestion.categoryLabel,
        reasoning: suggestion.reasoning,
      });
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
        className="w-full flex items-center gap-3 rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-left hover:border-violet-400 hover:bg-violet-50 transition disabled:opacity-50"
      >
        <span className="text-lg">🔍</span>
        <div>
          <p className="text-sm font-medium text-neutral-800">{pending ? "Analyzing…" : "Triage Issue"}</p>
          <p className="text-xs text-neutral-400">Auto-classify priority & category</p>
        </div>
      </button>
    );
  }

  // Suggestion available — show results card (full width, below the action buttons)
  return (
    <div className={inline ? "rounded-lg border border-violet-200 bg-white p-3 space-y-2" : "rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">✨ Triage Result</p>
        <span className="text-[11px] text-violet-400">{ageLabel}</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 shrink-0 w-20">Priority</span>
          <span className="font-medium text-neutral-800 capitalize">{suggestion.priority}</span>
        </div>
        {suggestion.categoryLabel && (
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 shrink-0 w-20">Category</span>
            <span className="font-medium text-neutral-800">{suggestion.categoryLabel}</span>
          </div>
        )}
        {(suggestion.duplicateCandidates ?? []).length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-neutral-500 shrink-0 w-20 pt-0.5">Possible dup</span>
            <ul className="space-y-1">
              {(suggestion.duplicateCandidates ?? []).map((d) => (
                <li key={d.id} className="flex items-center gap-1.5">
                  <span className="text-amber-700 truncate max-w-[120px] text-xs" title={d.title}>
                    ⚠ #{d.number} {d.title}
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => startTransition(() => markDuplicateAction(slug, issueId, d.id, `#${d.number}`))}
                      disabled={pending}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 whitespace-nowrap disabled:opacity-50"
                    >
                      Mark dup
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-neutral-500 leading-relaxed pt-1 border-t border-violet-100">
          {suggestion.reasoning}
        </p>
      </div>

      {!readOnly && (
        <div className="flex gap-2 pt-1">
          <button onClick={accept} disabled={pending}
            className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            {pending ? "Applying…" : "Accept"}
          </button>
          <button onClick={runTriage} disabled={pending}
            className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-100 disabled:opacity-50">
            Re-analyze
          </button>
          <button onClick={dismiss} disabled={pending}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
