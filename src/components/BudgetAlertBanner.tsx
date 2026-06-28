"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProjectBudgetStatus } from "@/lib/services/projectBudget";

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function BudgetAlertBanner({
  projectId,
  slug,
  projectName,
  projectKey,
}: {
  projectId: string;
  slug: string;
  projectName: string;
  projectKey: string;
}) {
  const [status, setStatus] = useState<ProjectBudgetStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/budget-status?slug=${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProjectBudgetStatus | null) => {
        if (!data) return;
        setStatus(data);
        if (data.budgetCents != null && data.thresholdPct != null && data.overThreshold) {
          const key = `budget-dismissed-${projectId}-${Math.floor(data.pct / 10)}`;
          setDismissed(!!sessionStorage.getItem(key));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId, slug]);

  if (!loaded || !status) return null;
  if (!status.budgetCents || !status.thresholdPct) return null;
  if (!status.overThreshold) return null;
  if (dismissed) return null;

  const dismissKey = `budget-dismissed-${projectId}-${Math.floor(status.pct / 10)}`;

  function dismiss() {
    sessionStorage.setItem(dismissKey, "1");
    setDismissed(true);
  }

  const isOver = status.pct >= 100;

  if (isOver) {
    const overBy = status.totalBurnCents - (status.budgetCents ?? 0);
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <span>🚨</span>
        <p className="flex-1 text-sm text-red-800">
          <strong>Over budget:</strong> {projectName} has exceeded budget by {fmt(overBy)}
        </p>
        <Link href={`/${slug}/projects/${projectKey}?tab=costs`} className="text-xs font-medium text-red-700 underline hover:text-red-900">
          View budget →
        </Link>
        <button onClick={dismiss} className="text-red-400 hover:text-red-700 text-sm px-1">✕</button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span>⚠</span>
      <p className="flex-1 text-sm text-amber-800">
        <strong>Budget alert:</strong> {projectName} is at {status.pct}% of budget ({fmt(status.totalBurnCents)} of {fmt(status.budgetCents ?? 0)} spent)
      </p>
      <Link href={`/${slug}/projects/${projectKey}?tab=costs`} className="text-xs font-medium text-amber-700 underline hover:text-amber-900">
        View budget →
      </Link>
      <button onClick={dismiss} className="text-amber-400 hover:text-amber-700 text-sm px-1">✕</button>
    </div>
  );
}
