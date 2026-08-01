"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/patterns/PageHeader";
import AdminList, { type AdminListItem } from "@/components/patterns/admin/AdminList";
import Note from "@/components/patterns/admin/Note";

type ExportRow = {
  id: string;
  label: string;
  description: string;
  endpoint: (slug: string) => string;
  filename: string;
};

const EXPORTS: ExportRow[] = [
  {
    id: "issues",
    label: "Issues CSV",
    description: "All issues including title, status, priority, type, assignee, dates, and source.",
    endpoint: (slug) => `/api/export/issues?slug=${slug}`,
    filename: "issues.csv",
  },
  {
    id: "sprints",
    label: "Sprint Report CSV",
    description: "All sprints with issue counts, velocity percentage, start/end dates, and goals.",
    endpoint: (slug) => `/api/export/sprints?slug=${slug}`,
    filename: "sprints.csv",
  },
  {
    id: "time-logs",
    label: "Time Logs CSV",
    description: "Every time entry logged against issues — hours, who logged, and notes.",
    endpoint: (slug) => `/api/export/time-logs?slug=${slug}`,
    filename: "time-logs.csv",
  },
];

function useDownload(slug: string, row: ExportRow) {
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
    status === "error" ? "Failed — retry" :
    "Download";

  return { download, label, status };
}

export default function ExportPage() {
  const params = useParams();
  const slug = params.tenant as string;

  // Hooks must run unconditionally, so build download handlers up-front.
  const downloads = EXPORTS.map((row) => useDownload(slug, row));

  const items: AdminListItem[] = EXPORTS.map((row, i) => ({
    key: row.id,
    title: row.label,
    subline: row.description,
    meta: "CSV",
    actionLabel: downloads[i].label,
    onAction: downloads[i].download,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Export Data" subtitle="Download workspace data as CSV" />

      <div className="space-y-4 px-6">
        <AdminList items={items} />

        <Note icon="ℹ" tone="info">
          Exports are scoped to this workspace only. For programmatic access, use the{" "}
          <code className="rounded bg-white/60 px-1 font-mono text-[11px]">/api/v1/issues/export</code> endpoint with an{" "}
          <a href={`/${slug}/admin/api-keys`} className="font-semibold underline">API key</a> — it supports filtering by project, status, and priority.
        </Note>
      </div>
    </div>
  );
}
