"use client";

import { useEffect, useRef, useState } from "react";
import { getAttachmentDownloadUrlAction } from "./actions";
import { summarizeReplayAction, getReplayContextBadgesAction, type ReplayContextBadges } from "./replayActions";
import type { IssueComment } from "@/lib/repositories/issueActivity";
import "rrweb/dist/style.css";

/** FORGE-71: prominent, dedicated replay entry point — deliberately NOT nested
 * inside the Attachments list, so it can't get lost the way a plain file
 * attachment can. */
export function SessionReplayCard({
  slug,
  issueId,
  storagePath,
  onCommentAdded,
}: {
  slug: string;
  issueId: string;
  storagePath: string;
  onCommentAdded?: (comment: IssueComment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarized, setSummarized] = useState(false);
  const [badges, setBadges] = useState<ReplayContextBadges | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReplayContextBadgesAction(slug, issueId, storagePath)
      .then((b) => { if (!cancelled) setBadges(b); })
      .catch(() => { /* badges are a nice-to-have, fail silently */ });
    return () => { cancelled = true; };
  }, [slug, issueId, storagePath]);

  async function summarize() {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const comment = await summarizeReplayAction(slug, issueId, storagePath);
      onCommentAdded?.(comment);
      setSummarized(true);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Could not summarize replay.");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎥</span>
          <div>
            <p className="text-sm font-semibold text-violet-900">Session Replay available</p>
            <p className="text-xs text-violet-600">See exactly what the user did before this was reported.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!summarized && (
            <button
              onClick={summarize}
              disabled={summarizing}
              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {summarizing ? "Summarizing…" : "✨ Summarize"}
            </button>
          )}
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            ▶ Watch replay
          </button>
        </div>
      </div>
      {summaryError && <p className="mt-2 text-xs text-red-600">{summaryError}</p>}
      {summarized && <p className="mt-2 text-xs text-violet-600">Summary posted to Activity below. ✓</p>}

      {(badges?.deployBadge || badges?.customerBadge) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.deployBadge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
              🚀 {badges.deployBadge}
            </span>
          )}
          {badges.customerBadge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              💼 {badges.customerBadge}
            </span>
          )}
        </div>
      )}

      {open && <ReplayModal slug={slug} storagePath={storagePath} onClose={() => setOpen(false)} />}
    </div>
  );
}

// FORGE-71: rrweb-player (the ready-made Svelte UI wrapper) has a real bug in
// this environment — its internal Replayer/iframe never mounts, silently, no
// console error. Proven by testing the identical event data completely
// outside Next.js: rrweb-player produced the same empty shell, while
// rrweb.Replayer (the lower-level primitive — what Sentry's own player is
// built on) rendered the reconstructed page correctly. Using that directly
// here with a small hand-built control bar instead of trusting the wrapper.
type ReplayerInstance = {
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  destroy: () => void;
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  wrapper: HTMLElement;
};

function ReplayModal({ slug, storagePath, onClose }: { slug: string; storagePath: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [totalMs, setTotalMs] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = await getAttachmentDownloadUrlAction(slug, storagePath);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not load the replay file.");
        const events = await res.json();
        if (!Array.isArray(events) || events.length === 0) throw new Error("Replay has no recorded events.");
        if (cancelled) return;

        const { Replayer } = await import("rrweb");
        if (cancelled || !containerRef.current) return;

        const replayer = new Replayer(events, { root: containerRef.current }) as unknown as ReplayerInstance;
        replayerRef.current = replayer;
        setTotalMs(replayer.getMetaData().totalTime);
        replayer.play();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load replay.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      replayerRef.current?.destroy();
      replayerRef.current = null;
    };
  }, [slug, storagePath]);

  function toggle() {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) r.pause();
    else r.play();
    setPlaying(!playing);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] max-w-[95vw] overflow-auto rounded-xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">Session Replay</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
        </div>
        {loading && <p className="text-sm text-neutral-500">Loading replay…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {/* rrweb.Replayer inserts the reconstructed page as a fixed-size iframe
            (sized to the recorded viewport, which is often taller than any
            reasonable modal). It does not scale that iframe to fit the root —
            it only positions it — so the root here must actually be scrollable,
            not just tall, or anything below the recorded fold is unreachable. */}
        <div
          ref={containerRef}
          className="max-h-[70vh] max-w-[90vw] overflow-auto rounded-lg border border-neutral-200"
          style={{ width: 1100, height: 700 }}
        />
        {!loading && !error && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={toggle}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <span className="text-xs text-neutral-400">{(totalMs / 1000).toFixed(1)}s recording</span>
          </div>
        )}
      </div>
    </div>
  );
}
