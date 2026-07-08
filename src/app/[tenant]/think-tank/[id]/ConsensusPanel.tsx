"use client";

import { useState, useTransition } from "react";
import { synthesizeDiscussionAction, type ConsensusSynthesis } from "../actions";

interface Props {
  slug: string;
  ideaId: string;
  isViewer: boolean;
  commentCount: number;
}

const MIN_COMMENTS = 3;

export default function ConsensusPanel({ slug, ideaId, isViewer, commentCount }: Props) {
  const [result, setResult] = useState<ConsensusSynthesis | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isViewer || commentCount < MIN_COMMENTS) return null;

  function handleRun() {
    setError(null);
    startTransition(async () => {
      try {
        const synthesis = await synthesizeDiscussionAction(slug, ideaId);
        setResult(synthesis);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Consensus synthesis failed.");
      }
    });
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-teal-800">🤝 AI Consensus Builder</p>
            <p className="mt-0.5 text-xs text-teal-600">
              {commentCount} comments in this discussion — AI can synthesize areas of agreement, contention, and a recommended next step.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={isPending}
            className="shrink-0 rounded-lg bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Synthesizing…" : "Build consensus"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-teal-100">
        <p className="text-sm font-semibold text-teal-800">🤝 AI Consensus</p>
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={isPending}
            className="text-xs text-teal-600 hover:text-teal-900 disabled:opacity-50"
          >
            {isPending ? "Re-synthesizing…" : "Re-run"}
          </button>
          <button
            onClick={() => setResult(null)}
            className="text-xs text-teal-400 hover:text-teal-700"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Summary */}
        <p className="text-sm text-teal-900 italic">{result.summary}</p>

        {/* Agreement */}
        {result.agreement.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-1.5">Areas of agreement</p>
            <ul className="space-y-1">
              {result.agreement.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-teal-900">
                  <span className="text-teal-400 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contention */}
        {result.contention.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1.5">Unresolved tensions</p>
            <ul className="space-y-1">
              {result.contention.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-amber-900">
                  <span className="text-amber-400 shrink-0">⚡</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Themes */}
        {result.themes.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-1.5">Key themes</p>
            <div className="flex flex-wrap gap-1.5">
              {result.themes.map((theme, i) => (
                <span key={i} className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs text-teal-800">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended next step */}
        {result.recommended_next && (
          <div className="rounded-lg border border-teal-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-1">Recommended next step</p>
            <p className="text-sm font-medium text-teal-900">{result.recommended_next}</p>
          </div>
        )}
      </div>

      <p className="border-t border-teal-100 px-5 py-2.5 text-[10px] text-teal-500">
        AI synthesis — review with your team before acting.
      </p>
    </div>
  );
}
