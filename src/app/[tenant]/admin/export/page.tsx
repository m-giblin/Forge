"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type ExportRow = {
  id: string;
  label: string;
  description: string;
  endpoint: (slug: string) => string;
  filename: string;
  icon: string;
};

const EXPORTS: ExportRow[] = [
  {
    id: "issues",
    label: "Issues CSV",
    description: "All issues including title, status, priority, type, assignee, dates, and source.",
    endpoint: (slug) => `/api/export/issues?slug=${slug}`,
    filename: "issues.csv",
    icon: "🐛",
  },
  {
    id: "sprints",
    label: "Sprint Report CSV",
    description: "All sprints with issue counts, velocity percentage, start/end dates, and goals.",
    endpoint: (slug) => `/api/export/sprints?slug=${slug}`,
    filename: "sprints.csv",
    icon: "🏃",
  },
  {
    id: "time-logs",
    label: "Time Logs CSV",
    description: "Every time entry logged against issues — hours, who logged, and notes.",
    endpoint: (slug) => `/api/export/time-logs?slug=${slug}`,
    filename: "time-logs.csv",
    icon: "⏱",
  },
];

function DownloadButton({ slug, row }: { slug: string; row: ExportRow }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function download() {
    setStatus("loading");
    try {
      const res = await fetch(row.endpoint(slug));
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const label =
    status === "loading" ? "Preparing…" :
    status === "done" ? "Downloaded ✓" :
    status === "error" ? "Failed — try again" :
    "Download CSV";

  return (
    <button
      onClick={download}
      disabled={status === "loading"}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition shrink-0 ${
        status === "done"
          ? "bg-green-50 text-green-700 border border-green-200"
          : status === "error"
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function ExportPage() {
  const params = useParams();
  const slug = params.tenant as string;

  return (
    <div className="max-w-2xl">
      <h2 className="text-base font-semibold text-neutral-900">Export Data</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Download your workspace data as CSV files. All exports are scoped to this workspace only.
      </p>

      <div className="mt-6 space-y-3">
        {EXPORTS.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-4"
          >
            <span className="text-2xl shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{row.label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{row.description}</p>
            </div>
            <DownloadButton slug={slug} row={row} />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> For programmatic access, use the{" "}
        <code className="rounded bg-amber-100 px-1 font-mono text-xs">/api/v1/issues/export</code>{" "}
        endpoint with an API key (Issues → <a href={`/${slug}/admin/api-keys`} className="underline font-medium">API Keys</a>).
        It supports filtering by project, status, and priority.
      </div>
    </div>
  );
}
