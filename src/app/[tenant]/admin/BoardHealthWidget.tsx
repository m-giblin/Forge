"use client";

import { useState, useTransition } from "react";
import type { BoardHealthDigest, BoardAlert } from "@/lib/services/boardMonitor";
import { timeAgo } from "@/lib/formatRelativeTime";

function levelColors(level: BoardAlert["level"]) {
  if (level === "critical")
    return { dot: "bg-red-500", badge: "bg-red-50 border-red-200 text-red-700", icon: "🚨" };
  if (level === "warning")
    return { dot: "bg-amber-500", badge: "bg-amber-50 border-amber-200 text-amber-700", icon: "⚠️" };
  return { dot: "bg-blue-500", badge: "bg-blue-50 border-blue-200 text-blue-700", icon: "ℹ️" };
}

export default function BoardHealthWidget({
  digest: initialDigest,
  slug,
}: {
  digest: BoardHealthDigest | null;
  slug: string;
}) {
  const [digest, setDigest] = useState(initialDigest);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rescan() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/cron/board-monitor`, {
          method: "POST",
          headers: { "x-internal-rescan": slug },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        // Reload the digest from the server action
        const r2 = await fetch(`/${slug}/admin?health=1`, { cache: "no-store" });
        if (r2.ok) {
          // Just reload the page to get fresh server data
          window.location.reload();
        }
      } catch (e) {
        setError(String(e));
      }
    });
  }

  const overallStatus =
    !digest || digest.alerts.length === 0
      ? "healthy"
      : digest.critical_count > 0
      ? "critical"
      : "warning";

  const statusConfig = {
    healthy: { label: "Board Healthy", color: "text-green-600", bg: "bg-green-50 border-green-200" },
    warning: { label: "Needs Attention", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    critical: { label: "Action Required", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  }[overallStatus];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-neutral-900">AI Board Health</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {digest && (
            <span className="text-xs text-neutral-400">
              Scanned {timeAgo(digest.scanned_at)}
            </span>
          )}
          <button
            onClick={rescan}
            disabled={isPending}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-50"
          >
            {isPending ? "Scanning…" : "Re-scan now"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            Scan failed: {error}
          </p>
        )}

        {!digest && !isPending && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-500">No scan data yet.</p>
            <p className="text-xs text-neutral-400 mt-1">
              Click &ldquo;Re-scan now&rdquo; to run your first board health check.
            </p>
          </div>
        )}

        {isPending && (
          <div className="text-center py-6">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="mt-2 text-sm text-neutral-500">Analyzing board with AI…</p>
          </div>
        )}

        {digest && !isPending && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Open Issues", value: digest.total_open, color: "text-neutral-900" },
                {
                  label: "Critical Alerts",
                  value: digest.critical_count,
                  color: digest.critical_count > 0 ? "text-red-600" : "text-neutral-900",
                },
                {
                  label: "Warnings",
                  value: digest.warning_count,
                  color: digest.warning_count > 0 ? "text-amber-600" : "text-neutral-900",
                },
              ].map((k) => (
                <div key={k.label} className="rounded-lg bg-neutral-50 px-3 py-2.5 text-center">
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {digest.alerts.length > 0 && (
              <div className="space-y-2">
                {digest.alerts.map((alert, i) => {
                  const c = levelColors(alert.level);
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 rounded-lg border px-3.5 py-2.5 ${c.badge}`}
                    >
                      <span className="mt-px shrink-0">{c.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        {alert.body && (
                          <p className="text-xs mt-0.5 opacity-80 truncate">{alert.body}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {digest.alerts.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-medium text-green-800">Board is in good shape</p>
                  <p className="text-xs text-green-700 mt-0.5">No critical issues or blockers detected.</p>
                </div>
              </div>
            )}

            {/* AI narrative */}
            {digest.ai_digest && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1.5">
                  AI Assessment
                </p>
                <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">
                  {digest.ai_digest}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
