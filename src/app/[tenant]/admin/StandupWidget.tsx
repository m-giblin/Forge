"use client";

import { useState, useTransition } from "react";
import type { StandupDigest, StandupEntry } from "@/lib/services/standupDigest";
import { AiBadge, AiDisclosureFooter } from "@/components/AiBadge";

const SECTION_META: Record<StandupEntry["section"], { emoji: string; label: string; color: string }> = {
  shipped: { emoji: "✅", label: "Shipped", color: "text-green-700 bg-green-50 border-green-200" },
  in_progress: { emoji: "🔄", label: "In Progress", color: "text-blue-700 bg-blue-50 border-blue-200" },
  blocked: { emoji: "🚨", label: "Blocked", color: "text-red-700 bg-red-50 border-red-200" },
  needs_triage: { emoji: "⚠️", label: "Needs Triage", color: "text-amber-700 bg-amber-50 border-amber-200" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StandupWidget({
  digest: initialDigest,
  slug,
}: {
  digest: StandupDigest | null;
  slug: string;
}) {
  const [digest, setDigest] = useState(initialDigest);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/cron/standup-digest`, {
          method: "POST",
          headers: { "x-internal-trigger": slug },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        window.location.reload();
      } catch (e) {
        setError(String(e));
      }
    });
  }

  const hasData = digest && digest.entries.length > 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">Daily Standup</span>
          {digest && (
            <span className="text-xs text-neutral-400">{digest.date_label}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {digest && (
            <span className="flex items-center gap-1.5">
              <AiBadge model="Grok (xAI)" />
              <span className="text-xs text-neutral-400">{timeAgo(digest.generated_at)}</span>
            </span>
          )}
          <button
            onClick={generate}
            disabled={isPending}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {isPending ? "Generating…" : "Generate now"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">
            {error}
          </p>
        )}

        {!hasData && !isPending && (
          <div className="text-center py-5">
            <p className="text-sm text-neutral-500">No standup digest yet for today.</p>
            <p className="text-xs text-neutral-400 mt-1">Runs automatically weekdays at 9am. Click &ldquo;Generate now&rdquo; to trigger manually.</p>
          </div>
        )}

        {isPending && (
          <div className="text-center py-5">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="mt-2 text-sm text-neutral-500">Generating digest with AI…</p>
          </div>
        )}

        {hasData && !isPending && (
          <div className="space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Shipped", value: digest.stats.shipped_today, color: "text-green-600" },
                { label: "In Progress", value: digest.stats.in_progress, color: "text-blue-600" },
                { label: "Blocked", value: digest.stats.blocked, color: digest.stats.blocked > 0 ? "text-red-600" : "text-neutral-900" },
                { label: "Unassigned", value: digest.stats.unassigned, color: digest.stats.unassigned > 5 ? "text-amber-600" : "text-neutral-900" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg bg-neutral-50 px-2 py-2 text-center">
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* AI summary */}
            {digest.ai_summary && (
              <div>
                <p className="text-sm text-neutral-700 leading-relaxed italic border-l-2 border-indigo-300 pl-3">
                  {digest.ai_summary}
                </p>
                <AiDisclosureFooter model="Grok (xAI)" />
              </div>
            )}

            {/* Sections — collapsible */}
            {digest.entries.map((entry) => {
              const meta = SECTION_META[entry.section];
              const isOpen = expanded[entry.section] !== false;
              return (
                <div key={entry.section} className={`rounded-lg border ${meta.color} overflow-hidden`}>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [entry.section]: !isOpen }))}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left`}
                  >
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      {meta.emoji} {meta.label}
                      <span className="rounded-full bg-white/60 px-1.5 py-0.5 font-medium">{entry.items.length}</span>
                    </span>
                    <span className="text-xs opacity-60">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <ul className="px-3 pb-2 space-y-0.5">
                      {entry.items.slice(0, 8).map((item, i) => (
                        <li key={i} className="text-xs truncate opacity-90">• {item}</li>
                      ))}
                      {entry.items.length > 8 && (
                        <li className="text-xs opacity-60">+{entry.items.length - 8} more</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
