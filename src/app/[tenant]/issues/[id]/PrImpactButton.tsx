"use client";

import { useState, useTransition } from "react";
import { predictPrImpactAction, reviewRiskGateAction, createActionItemsFromPredictionAction, type PrImpactPrediction } from "./prImpactAction";
import Modal from "@/components/Modal";

interface Props {
  slug: string;
  issueId: string;
  readOnly: boolean;
  userRole: string;
}

const RISK_COLOR: Record<string, string> = {
  low:      "bg-green-50 border-green-200 text-green-800",
  medium:   "bg-yellow-50 border-yellow-200 text-yellow-800",
  high:     "bg-orange-50 border-orange-200 text-orange-800",
  critical: "bg-red-50 border-red-200 text-red-800",
};

const RISK_EMOJI: Record<string, string> = {
  low: "🟢", medium: "🟡", high: "🟠", critical: "🔴",
};

export default function PrImpactButton({ slug, issueId, readOnly, userRole }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PrImpactPrediction | null>(null);
  const [gateId, setGateId] = useState<string | null>(null);
  const [gateDecision, setGateDecision] = useState<"approved" | "denied" | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewMode, setReviewMode] = useState<"approved" | "denied" | null>(null);
  const [actionItemsCreated, setActionItemsCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canReview = userRole === "owner" || userRole === "admin";
  const isHighRisk = result?.risk === "high" || result?.risk === "critical";

  if (readOnly) return null;

  function handlePredict() {
    setOpen(true);
    setResult(null);
    setGateId(null);
    setGateDecision(null);
    setReviewReason("");
    setReviewMode(null);
    setActionItemsCreated(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await predictPrImpactAction(slug, issueId);
        if (res.error) setError(res.error);
        else {
          setResult(res.prediction!);
          setGateId(res.gateId ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Prediction failed.");
      }
    });
  }

  function handleCreateActionItems() {
    if (!result?.suggestions?.length) return;
    startTransition(async () => {
      try {
        await createActionItemsFromPredictionAction(slug, issueId, result.suggestions);
        setActionItemsCreated(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create action items.");
      }
    });
  }

  function handleReview(decision: "approved" | "denied") {
    if (!gateId || !reviewReason.trim()) return;
    startTransition(async () => {
      try {
        await reviewRiskGateAction(slug, issueId, gateId, decision, reviewReason);
        setGateDecision(decision);
        setReviewMode(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Review failed.");
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

      <Modal open={open} onClose={() => setOpen(false)} label="PR Impact Prediction" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div>
              <p className="font-semibold text-neutral-900">PR Impact Prediction</p>
              <p className="text-xs text-neutral-500 mt-0.5">AI risk assessment before merge</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 text-xl">×</button>
          </div>

          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Loading */}
            {isPending && !result && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                <p className="text-sm text-neutral-500">Analysing risk with Grok…</p>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {result && !isPending && (
              <>
                {/* Risk badge */}
                <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${RISK_COLOR[result.risk] ?? RISK_COLOR.medium}`}>
                  <span className="text-2xl">{RISK_EMOJI[result.risk] ?? "⚪"}</span>
                  <div>
                    <p className="font-bold capitalize">{result.risk} risk</p>
                    <p className="text-xs opacity-80">Scope: {result.scope}</p>
                  </div>
                </div>

                {/* Gate status banner */}
                {gateId && (
                  <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                    gateDecision === "approved"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : gateDecision === "denied"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-orange-50 border-orange-200 text-orange-800"
                  }`}>
                    {gateDecision === "approved" && "✅ Risk gate approved — issue may now be closed."}
                    {gateDecision === "denied" && "❌ Risk gate denied — issue remains blocked. Address concerns and re-analyse."}
                    {!gateDecision && "🚨 Risk gate active — this issue is blocked from closing until reviewed."}
                  </div>
                )}

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

                    {/* Create action items */}
                    {!actionItemsCreated ? (
                      <button
                        onClick={handleCreateActionItems}
                        disabled={isPending}
                        className="mt-3 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                      >
                        {isPending ? "Creating…" : `📋 Create ${result.suggestions.length} action item${result.suggestions.length !== 1 ? "s" : ""} as sub-issues`}
                      </button>
                    ) : (
                      <p className="mt-3 text-xs text-green-600 font-medium">✅ Action items created as sub-issues</p>
                    )}
                  </div>
                )}

                {/* Approve / Deny for PM/Admin when gate is open */}
                {gateId && !gateDecision && canReview && isHighRisk && (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Risk Gate Review</p>
                    <p className="text-xs text-neutral-500">As a project manager or admin, you can approve or deny this gate. A reason is required.</p>

                    {!reviewMode ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReviewMode("approved")}
                          className="flex-1 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => setReviewMode("denied")}
                          className="flex-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        >
                          ❌ Deny
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-neutral-700">
                          {reviewMode === "approved" ? "Reason for approving:" : "Reason for denying:"}
                        </p>
                        <textarea
                          value={reviewReason}
                          onChange={(e) => setReviewReason(e.target.value)}
                          placeholder={reviewMode === "approved"
                            ? "e.g. Security team reviewed and signed off on OAuth flow"
                            : "e.g. OAuth token storage must be encrypted before merge"
                          }
                          rows={3}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-indigo-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(reviewMode)}
                            disabled={isPending || !reviewReason.trim()}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50 ${
                              reviewMode === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {isPending ? "Submitting…" : `Confirm ${reviewMode === "approved" ? "Approval" : "Denial"}`}
                          </button>
                          <button
                            onClick={() => { setReviewMode(null); setReviewReason(""); }}
                            className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
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
