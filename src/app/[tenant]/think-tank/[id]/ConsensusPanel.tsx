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
      <div className="rounded-xl border border-[#e4d4c4] bg-[#f4ece4]/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#8c4632]">🤝 AI Consensus Builder</p>
            <p className="mt-0.5 text-xs text-[#b7452f]">
              {commentCount} comments in this discussion — AI can synthesize areas of agreement, contention, and a recommended next step.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={isPending}
            className="shrink-0 rounded-lg border border-[#5e2c1f] px-4 py-1.5 text-sm font-medium text-[#f2e9d8] disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
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
    <div className="rounded-xl border border-[#e4d4c4] bg-[#f4ece4] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#e4d4c4]">
        <p className="text-sm font-semibold text-[#8c4632]">🤝 AI Consensus</p>
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={isPending}
            className="text-xs text-[#b7452f] hover:text-[#20201d] disabled:opacity-50"
          >
            {isPending ? "Re-synthesizing…" : "Re-run"}
          </button>
          <button
            onClick={() => setResult(null)}
            className="text-xs text-[#b7452f]/60 hover:text-[#8c4632]"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Summary */}
        <p className="text-sm text-[#20201d] italic">{result.summary}</p>

        {/* Agreement */}
        {result.agreement.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#b7452f] mb-1.5">Areas of agreement</p>
            <ul className="space-y-1">
              {result.agreement.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#20201d]">
                  <span className="text-[#b7452f]/60 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contention */}
        {result.contention.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#c9791d] mb-1.5">Unresolved tensions</p>
            <ul className="space-y-1">
              {result.contention.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#8a5410]">
                  <span className="text-[#c9791d] shrink-0">⚡</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Themes */}
        {result.themes.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#b7452f] mb-1.5">Key themes</p>
            <div className="flex flex-wrap gap-1.5">
              {result.themes.map((theme, i) => (
                <span key={i} className="rounded-full bg-[#e4d4c4] px-2.5 py-0.5 text-xs text-[#8c4632]">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended next step */}
        {result.recommended_next && (
          <div className="rounded-lg border border-[#e4d4c4] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#b7452f] mb-1">Recommended next step</p>
            <p className="text-sm font-medium text-[#20201d]">{result.recommended_next}</p>
          </div>
        )}
      </div>

      <p className="border-t border-[#e4d4c4] px-5 py-2.5 text-[10px] text-[#a19d90]">
        AI synthesis — review with your team before acting.
      </p>
    </div>
  );
}
