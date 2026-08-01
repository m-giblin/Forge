"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startEstimationSessionAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import Note from "@/components/patterns/admin/Note";
import AdminList from "@/components/patterns/admin/AdminList";

type Project = { id: string; key: string; name: string };
type Session = { id: string; createdAt: string };

export default function EstimationPokerLanding({
  slug, projects, projectId, activeSessions, unestimatedCount,
}: {
  slug: string; projects: Project[]; projectId: string; activeSessions: Session[]; unestimatedCount: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function switchProject(id: string) {
    router.push(`/${slug}/estimation-poker?project=${id}`);
  }

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const sessionId = await startEstimationSessionAction(slug, projectId);
        router.push(`/${slug}/estimation-poker/${sessionId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start session");
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Estimation Poker"
        subtitle="Vote, reveal, apply — one issue at a time"
        right={
          <select
            value={projectId}
            onChange={(e) => switchProject(e.target.value)}
            className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[11.5px] font-semibold text-[#4a473e] outline-none focus:border-[#b7452f]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

      <div className="mx-auto max-w-xl space-y-5 px-6 py-5">
        {error && <p className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</p>}

        {activeSessions.length > 0 && (
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Session already in progress</p>
            <AdminList
              items={activeSessions.map((s) => ({
                key: s.id,
                title: `Session started ${new Date(s.createdAt).toLocaleString()}`,
                actionLabel: "Join →",
                onAction: () => router.push(`/${slug}/estimation-poker/${s.id}`),
              }))}
            />
          </div>
        )}

        <Note icon="🃏" tone={unestimatedCount === 0 ? "info" : "info"}>
          {unestimatedCount === 0
            ? "Every issue in this project already has story points."
            : `${unestimatedCount} issue${unestimatedCount === 1 ? "" : "s"} without story points.`}
        </Note>

        <div className="fw-card px-6 py-8 text-center">
          <button
            onClick={start}
            disabled={pending || unestimatedCount === 0}
            className="rounded-[5px] border border-[#5e2c1f] px-5 py-[9px] text-[12.5px] font-semibold text-[#f2e9d8] disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            {pending ? "Starting…" : "Start a new session"}
          </button>
        </div>
      </div>
    </div>
  );
}
