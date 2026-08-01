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
  const style =
    score >= 80 ? { color: "#3f7d4c", background: "#e9f3ea", borderColor: "#3f7d4c" } :
    score >= 60 ? { color: "#3a6ea8", background: "#eaf1f8", borderColor: "#3a6ea8" } :
    score >= 40 ? { color: "#c9791d", background: "#fdf1de", borderColor: "#c9791d" } :
                  { color: "#c0392b", background: "#fbeae8", borderColor: "#c0392b" };
  const icon =
    score >= 80 ? "✓" :
    score >= 60 ? "→" :
    score >= 40 ? "⚠" : "✕";
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold" style={style}>
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
        <div className="mt-3 pt-3 border-t border-[#ddd8c9]">
          <p className="text-xs text-[#a19d90]">
            🧠 <span className="font-medium">AI Sprint Intelligence</span> — add issues to this sprint to unlock analysis.
          </p>
        </div>
      );
    }
    if (sprintDays !== null && sprintDays < 3) {
      return (
        <div className="mt-3 pt-3 border-t border-[#ddd8c9]">
          <p className="text-xs text-[#a19d90]">
            🧠 <span className="font-medium">AI Sprint Intelligence</span> — sprint is too short ({sprintDays}d) for meaningful analysis. Extend to at least 3 days.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-3 border-t border-[#ddd8c9]">
        <button
          onClick={generate}
          className="flex items-center gap-2 rounded-lg border border-[#b7452f]/30 bg-[#fbeae8] px-4 py-2 text-sm font-medium text-[#b7452f] hover:bg-[#f4ecfa] transition"
        >
          <span>🧠</span>
          Generate AI Sprint Intelligence
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mt-3 pt-3 border-t border-[#ddd8c9]">
        <div className="flex items-center gap-2 text-sm text-[#726e60]">
          <svg className="h-4 w-4 animate-spin text-[#b7452f]" viewBox="0 0 24 24" fill="none">
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
      <div className="mt-3 pt-3 border-t border-[#ddd8c9]">
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#c0392b]">{errorMsg}</p>
          <button
            onClick={() => setState("idle")}
            className="text-xs text-[#726e60] underline hover:text-[#4a473e]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[#ddd8c9] space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="text-sm font-semibold text-[#4a473e]">AI Sprint Intelligence</span>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge score={report.score} label={report.scoreLabel} />
          <button
            onClick={() => setState("idle")}
            className="text-xs text-[#a19d90] hover:text-[#4a473e]"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm text-[#4a473e] leading-relaxed">{report.headline}</p>

      {/* Metrics strip */}
      {metrics && (
        <div className="flex flex-wrap gap-4">
          <div className="text-center">
            <p className="text-xl font-black text-[#20201d]">{metrics.completionRate}%</p>
            <p className="text-xs text-[#726e60]">Completion rate</p>
          </div>
          {metrics.totalPoints > 0 && (
            <div className="text-center">
              <p className="text-xl font-black text-[#20201d]">{metrics.donePoints}<span className="text-sm font-normal text-[#a19d90]">/{metrics.totalPoints}</span></p>
              <p className="text-xs text-[#726e60]">Story points</p>
            </div>
          )}
          {metrics.avgCycleTime !== null && (
            <div className="text-center">
              <p className="text-xl font-black text-[#20201d]">{metrics.avgCycleTime}d</p>
              <p className="text-xs text-[#726e60]">Avg cycle time</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xl font-black text-[#20201d]">{metrics.done}<span className="text-sm font-normal text-[#a19d90]">/{metrics.total}</span></p>
            <p className="text-xs text-[#726e60]">Issues closed</p>
          </div>
        </div>
      )}

      {/* Wins + Risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {report.wins.length > 0 && (
          <div className="rounded-lg bg-[#e9f3ea] border border-[#3f7d4c]/20 px-3 py-2.5">
            <p className="text-xs font-semibold text-[#3f7d4c] mb-1.5">✓ Wins</p>
            <ul className="space-y-1">
              {report.wins.map((w, i) => (
                <li key={i} className="text-xs text-[#3f7d4c] leading-snug">{w}</li>
              ))}
            </ul>
          </div>
        )}
        {report.risks.length > 0 && (
          <div className="rounded-lg bg-[#fdf1de] border border-[#c9791d]/20 px-3 py-2.5">
            <p className="text-xs font-semibold text-[#c9791d] mb-1.5">⚠ Watch</p>
            <ul className="space-y-1">
              {report.risks.map((r, i) => (
                <li key={i} className="text-xs text-[#c9791d] leading-snug">{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-lg bg-[#f4ecfa] border border-[#7a4fa0]/20 px-3 py-2.5">
        <p className="text-xs font-semibold text-[#7a4fa0] mb-1">💡 Recommendation for next sprint</p>
        <p className="text-xs text-[#7a4fa0] leading-snug">{report.recommendation}</p>
      </div>
    </div>
  );
}
