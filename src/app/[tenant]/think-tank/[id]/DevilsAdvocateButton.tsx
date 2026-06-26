"use client";

import { useState, useTransition } from "react";
import { soundingBoardAction } from "../actions";
import ReactMarkdown from "react-markdown";

export default function DevilsAdvocateButton({
  slug,
  ideaId,
}: {
  slug: string;
  ideaId: string;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function challenge() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await soundingBoardAction(slug, ideaId, ["devils_advocate"], "");
        setResult(res.text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Challenge failed");
      }
    });
  }

  if (result) {
    return (
      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-rose-100">
          <p className="text-sm font-semibold text-rose-800">🔥 Devil&apos;s Advocate Analysis</p>
          <div className="flex gap-2">
            <button
              onClick={challenge}
              disabled={isPending}
              className="text-xs text-rose-500 hover:text-rose-800 disabled:opacity-50"
            >
              {isPending ? "Re-challenging…" : "Re-run"}
            </button>
            <button onClick={() => setResult(null)} className="text-xs text-rose-400 hover:text-rose-700">Dismiss</button>
          </div>
        </div>
        <div className="px-5 py-4 prose prose-sm prose-rose max-w-none text-rose-900">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={challenge}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" /> Challenging idea…</>
        ) : (
          <>🔥 Challenge This Idea</>
        )}
      </button>
      <p className="mt-1 text-xs text-neutral-400 ml-0.5">AI will argue against this idea to surface hidden weaknesses.</p>
    </div>
  );
}
