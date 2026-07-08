"use client";

import { useState, useTransition } from "react";
import {
  loadOkrAlignmentAction,
  scoreOkrAlignmentAction,
  linkIdeaToOkrAction,
  unlinkIdeaFromOkrAction,
  type OkrAlignmentResult,
} from "../actions";

interface Props {
  slug: string;
  ideaId: string;
  isViewer: boolean;
  initialResults: OkrAlignmentResult[];
}

function ScoreBar({ score }: { score: number }) {
  const colors = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500"];
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-2 w-6 rounded-full transition-all ${n <= score ? colors[score] : "bg-neutral-100"}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-neutral-700">{score}/5</span>
    </div>
  );
}

export default function OkrAlignmentPanel({ slug, ideaId, isViewer, initialResults }: Props) {
  const [results, setResults] = useState<OkrAlignmentResult[]>(initialResults);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-sm font-medium text-neutral-700">🎯 OKR Alignment</p>
        </div>
        <p className="px-5 py-4 text-sm text-neutral-400">
          No active OKRs found. Add OKRs in your team settings to score alignment.
        </p>
      </div>
    );
  }

  function handleScoreOkr(okrId: string) {
    setError(null);
    setScoringId(okrId);
    startTransition(async () => {
      try {
        const { score, justification } = await scoreOkrAlignmentAction(slug, ideaId, okrId);
        setResults((prev) =>
          prev.map((r) =>
            r.okr.id === okrId ? { ...r, score, linked: true } : r
          )
        );
        setJustifications((prev) => ({ ...prev, [okrId]: justification }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scoring failed.");
      } finally {
        setScoringId(null);
      }
    });
  }

  function handleLink(okrId: string) {
    startTransition(async () => {
      try {
        await linkIdeaToOkrAction(slug, ideaId, okrId);
        setResults((prev) =>
          prev.map((r) => (r.okr.id === okrId ? { ...r, linked: true } : r))
        );
        setShowPicker(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Link failed.");
      }
    });
  }

  function handleUnlink(okrId: string) {
    startTransition(async () => {
      try {
        await unlinkIdeaFromOkrAction(slug, ideaId, okrId);
        setResults((prev) =>
          prev.map((r) => (r.okr.id === okrId ? { ...r, linked: false, score: null } : r))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unlink failed.");
      }
    });
  }

  async function handleRefresh() {
    startTransition(async () => {
      try {
        const fresh = await loadOkrAlignmentAction(slug, ideaId);
        setResults(fresh);
      } catch {
        // ignore
      }
    });
  }

  const linked = results.filter((r) => r.linked);
  const unlinked = results.filter((r) => !r.linked);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <p className="text-sm font-medium text-neutral-700">🎯 OKR Alignment</p>
        {!isViewer && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPicker(!showPicker)}
              disabled={isPending}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
            >
              + Link OKR
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* OKR Picker */}
      {showPicker && unlinked.length > 0 && (
        <div className="border-b border-neutral-100 px-5 py-3 space-y-1">
          <p className="text-xs font-medium text-neutral-500 mb-2">Select an OKR to link:</p>
          {unlinked.map((r) => (
            <button
              key={r.okr.id}
              onClick={() => handleLink(r.okr.id)}
              disabled={isPending}
              className="w-full text-left rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50 transition disabled:opacity-50"
            >
              <span className="font-medium text-neutral-800">{r.okr.title}</span>
              {r.okr.quarter && (
                <span className="ml-2 text-xs text-neutral-400">{r.okr.quarter}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Linked OKRs */}
      {linked.length > 0 ? (
        <div className="divide-y divide-neutral-100">
          {linked.map((r) => (
            <div key={r.okr.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800 truncate">{r.okr.title}</span>
                    {r.okr.quarter && (
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600 font-medium">
                        {r.okr.quarter}
                      </span>
                    )}
                  </div>
                  {r.score !== null ? (
                    <div className="mt-2">
                      <ScoreBar score={r.score} />
                      {(justifications[r.okr.id] ?? r.justification) && (
                        <p className="mt-1.5 text-xs text-neutral-500 italic">
                          {justifications[r.okr.id] ?? r.justification}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-400">Not yet scored</p>
                  )}
                </div>
                {!isViewer && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => handleScoreOkr(r.okr.id)}
                      disabled={isPending || scoringId === r.okr.id}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {scoringId === r.okr.id ? "Scoring…" : r.score !== null ? "Re-score" : "AI Score"}
                    </button>
                    <button
                      onClick={() => handleUnlink(r.okr.id)}
                      disabled={isPending}
                      className="text-[10px] text-neutral-400 hover:text-red-500 disabled:opacity-50"
                    >
                      Unlink
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-sm text-neutral-400">
          No OKRs linked yet.{" "}
          {!isViewer && (
            <button
              onClick={() => setShowPicker(true)}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Link one above.
            </button>
          )}
        </div>
      )}

      <div className="border-t border-neutral-100 px-5 py-2.5 flex items-center justify-between">
        <p className="text-[10px] text-neutral-400">
          AI scores how well this idea supports each OKR (1-5).
        </p>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="text-[10px] text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
