"use client";

import { useState } from "react";

interface IntelligenceReport {
  headline: string;
  scoreLabel: string;
  score: number;
  wins: string[];
  risks: string[];
  recommendation: string;
}

interface IntelligenceMetrics {
  total: number;
  done: number;
  completionRate: number;
  avgCycleTime: number | null;
  donePoints: number;
  totalPoints: number;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    score >= 60 ? "bg-blue-100 text-blue-700 border-blue-200" :
    score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-red-100 text-red-700 border-red-200";
  const icon =
    score >= 80 ? "✓" :
    score >= 60 ? "→" :
    score >= 40 ? "⚠" : "✕";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${color}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function SprintIntelligence({
  slug,
  sprintId,
  issueCount,
  sprintDays,
}: {
  slug: string;
  sprintId: string;
  issueCount: number;
  sprintDays: number | null;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [metrics, setMetrics] = useState<IntelligenceMetrics | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function generate() {
    setState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tenants/${slug}/sprints/${sprintId}/intelligence`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }
      setReport(data.report as IntelligenceReport);
      setMetrics(data.metrics as IntelligenceMetrics);
      setState("done");
    } catch {
      setErrorMsg("Failed to reach the AI service. Try again.");
      setState("error");
    }
  }

  if (state === "idle") {
    // Not enough data to analyze — show a contextual nudge instead of the button
    if (issueCount === 0) {
      return (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-400">
            🧠 <span className="font-medium">AI Sprint Intelligence</span> — add issues to this sprint to unlock analysis.
          </p>
        </div>
      );
    }
    if (sprintDays !== null && sprintDays < 3) {
      return (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-400">
            🧠 <span className="font-medium">AI Sprint Intelligence</span> — sprint is too short ({sprintDays}d) for meaningful analysis. Extend to at least 3 days.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <button
          onClick={generate}
          className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition"
        >
          <span>🧠</span>
          Generate AI Sprint Intelligence
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Analysing sprint data…
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button
            onClick={() => setState("idle")}
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="text-sm font-semibold text-neutral-700">AI Sprint Intelligence</span>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge score={report.score} label={report.scoreLabel} />
          <button
            onClick={() => setState("idle")}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm text-neutral-700 leading-relaxed">{report.headline}</p>

      {/* Metrics strip */}
      {metrics && (
        <div className="flex flex-wrap gap-4">
          <div className="text-center">
            <p className="text-xl font-black text-neutral-900">{metrics.completionRate}%</p>
            <p className="text-xs text-neutral-500">Completion rate</p>
          </div>
          {metrics.totalPoints > 0 && (
            <div className="text-center">
              <p className="text-xl font-black text-neutral-900">{metrics.donePoints}<span className="text-sm font-normal text-neutral-400">/{metrics.totalPoints}</span></p>
              <p className="text-xs text-neutral-500">Story points</p>
            </div>
          )}
          {metrics.avgCycleTime !== null && (
            <div className="text-center">
              <p className="text-xl font-black text-neutral-900">{metrics.avgCycleTime}d</p>
              <p className="text-xs text-neutral-500">Avg cycle time</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xl font-black text-neutral-900">{metrics.done}<span className="text-sm font-normal text-neutral-400">/{metrics.total}</span></p>
            <p className="text-xs text-neutral-500">Issues closed</p>
          </div>
        </div>
      )}

      {/* Wins + Risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {report.wins.length > 0 && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-emerald-700 mb-1.5">✓ Wins</p>
            <ul className="space-y-1">
              {report.wins.map((w, i) => (
                <li key={i} className="text-xs text-emerald-800 leading-snug">{w}</li>
              ))}
            </ul>
          </div>
        )}
        {report.risks.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-700 mb-1.5">⚠ Watch</p>
            <ul className="space-y-1">
              {report.risks.map((r, i) => (
                <li key={i} className="text-xs text-amber-800 leading-snug">{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5">
        <p className="text-xs font-semibold text-indigo-700 mb-1">💡 Recommendation for next sprint</p>
        <p className="text-xs text-indigo-800 leading-snug">{report.recommendation}</p>
      </div>
    </div>
  );
}
