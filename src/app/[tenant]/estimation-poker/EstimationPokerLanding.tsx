"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startEstimationSessionAction } from "./actions";

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
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Estimation Poker</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Vote on story points together — cards stay hidden until everyone reveals.</p>
        </div>
        <select
          value={projectId}
          onChange={(e) => switchProject(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {activeSessions.length > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="mb-2 text-sm font-semibold text-indigo-900">A session is already in progress</p>
          {activeSessions.map((s) => (
            <a
              key={s.id}
              href={`/${slug}/estimation-poker/${s.id}`}
              className="block rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
            >
              Join session started {new Date(s.createdAt).toLocaleString()} →
            </a>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm text-neutral-500">
          {unestimatedCount === 0
            ? "Every issue in this project already has story points."
            : `${unestimatedCount} issue${unestimatedCount === 1 ? "" : "s"} without story points.`}
        </p>
        <button
          onClick={start}
          disabled={pending || unestimatedCount === 0}
          className="mt-4 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start a new session"}
        </button>
      </div>
    </div>
  );
}
