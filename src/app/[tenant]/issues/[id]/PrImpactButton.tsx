"use client";

import { useState, useTransition } from "react";
import { predictPrImpactAction } from "./prImpactAction";
import Modal from "@/components/Modal";

interface Props {
  slug: string;
  issueId: string;
  readOnly: boolean;
}

const RISK_COLOR: Record<string, string> = {
  low:      "bg-green-50 border-green-200 text-green-800",
  medium:   "bg-yellow-50 border-yellow-200 text-yellow-800",
  high:     "bg-orange-50 border-orange-200 text-orange-800",
  critical: "bg-red-50 border-red-200 text-red-800",
};

export default function PrImpactButton({ slug, issueId, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    risk: string; scope: string; summary: string; concerns: string[]; suggestions: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (readOnly) return null;

  function handlePredict() {
    setOpen(true);
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await predictPrImpactAction(slug, issueId);
        if (res.error) setError(res.error);
        else setResult(res.prediction!);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Prediction failed.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handlePredict}
        className="w-full flex items-center gap-3 rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-left hover:border-violet-400 hover:bg-violet-50 transition"
      >
        <span className="text-lg">🔮</span>
        <div>
          <p className="text-sm font-medium text-neutral-800">PR Impact Prediction</p>
          <p className="text-xs text-neutral-400">AI risk assessment before merge</p>
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} label="PR Impact Prediction" className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <p className="font-semibold text-neutral-900">PR Impact Prediction</p>
                <p className="text-xs text-neutral-500 mt-0.5">AI risk assessment before merge</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 text-xl">×</button>
            </div>

            <div className="px-5 py-5">
              {isPending && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                  <p className="text-sm text-neutral-500">Analysing risk with Grok…</p>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
              )}

              {result && !isPending && (
                <div className="space-y-4">
                  {/* Risk badge */}
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${RISK_COLOR[result.risk] ?? RISK_COLOR.medium}`}>
                    <span className="text-2xl">
                      {result.risk === "low" ? "🟢" : result.risk === "medium" ? "🟡" : result.risk === "high" ? "🟠" : "🔴"}
                    </span>
                    <div>
                      <p className="font-bold capitalize">{result.risk} risk</p>
                      <p className="text-xs opacity-80">Scope: {result.scope}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-neutral-700">{result.summary}</p>

                  {/* Concerns */}
                  {result.concerns.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 mb-2">Potential concerns</p>
                      <ul className="space-y-1.5">
                        {result.concerns.map((c, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="shrink-0 text-orange-500">⚠</span>
                            <span className="text-neutral-700">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 mb-2">Suggestions</p>
                      <ul className="space-y-1.5">
                        {result.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="shrink-0 text-green-500">✓</span>
                            <span className="text-neutral-700">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 px-5 py-3 flex justify-end gap-2">
              {result && !isPending && (
                <button
                  onClick={handlePredict}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Re-analyse
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
              >
                Close
              </button>
            </div>
          </div>
      </Modal>
    </>
  );
}
