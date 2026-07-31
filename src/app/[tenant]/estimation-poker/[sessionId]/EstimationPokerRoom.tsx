"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { castVoteAction, revealVotesAction, applyPointsAction, skipIssueAction, endSessionAction } from "../actions";

const DECK = ["1", "2", "3", "5", "8", "13", "21", "?"];

type Option = { key: string; label: string; color?: string | null };
type Member = { userId: string; label: string };
type Issue = { id: string; number: number; title: string; description: string | null; type: string; priority: string; storyPoints: number | null };
type Vote = { userId: string; value: string };

export default function EstimationPokerRoom({
  slug, sessionId, projectId, project, meUserId, members, priorities, types,
  initialStatus, initialCurrentIssueId, initialRevealed, initialIssue, initialVotes,
}: {
  slug: string; sessionId: string; projectId: string;
  project: { key: string; name: string }; meUserId: string; members: Member[];
  priorities: Option[]; types: Option[];
  initialStatus: "active" | "completed"; initialCurrentIssueId: string | null; initialRevealed: boolean;
  initialIssue: Issue | null; initialVotes: Vote[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [currentIssueId, setCurrentIssueId] = useState(initialCurrentIssueId);
  const [issue, setIssue] = useState(initialIssue);
  const [revealed, setRevealed] = useState(initialRevealed);
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  const [presentUsers, setPresentUsers] = useState<Member[]>([]);
  const [applyPoints, setApplyPoints] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Resync local state during render (not an effect) whenever the server hands
  // us a fresh current issue via router.refresh() — the React-recommended
  // pattern for "adjust state when a prop changes" without an extra render pass.
  const [syncedIssueId, setSyncedIssueId] = useState(initialCurrentIssueId);
  if (syncedIssueId !== initialCurrentIssueId) {
    setSyncedIssueId(initialCurrentIssueId);
    setIssue(initialIssue);
    setVotes(initialVotes);
    setRevealed(initialRevealed);
    setCurrentIssueId(initialCurrentIssueId);
    setApplyPoints(initialRevealed ? String(medianVote(initialVotes) ?? "") : "");
  }

  const memberMap = useMemo(() => new Map(members.map((m) => [m.userId, m.label])), [members]);
  const priMap = useMemo(() => new Map(priorities.map((p) => [p.key, p])), [priorities]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.key, t.label])), [types]);
  const myVote = votes.find((v) => v.userId === meUserId)?.value ?? null;

  // Fill in a points suggestion the moment votes get revealed (but let the user keep editing it afterward).
  const [suggestedForReveal, setSuggestedForReveal] = useState(false);
  if (revealed && !suggestedForReveal) {
    setSuggestedForReveal(true);
    const suggestion = medianVote(votes);
    if (suggestion != null) setApplyPoints(String(suggestion));
  } else if (!revealed && suggestedForReveal) {
    setSuggestedForReveal(false);
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!active) return;
      if (authSession?.access_token) supabase.realtime.setAuth(authSession.access_token);

      const meLabel = memberMap.get(meUserId) ?? "You";

      channel = supabase
        .channel(`estimation:${sessionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "estimation_sessions", filter: `id=eq.${sessionId}` },
          (payload) => {
            const row = payload.new as { current_issue_id: string | null; revealed: boolean; status: "active" | "completed" };
            setStatus(row.status);
            if (row.current_issue_id !== currentIssueId) {
              router.refresh(); // fetch the new current issue's details server-side
            } else {
              setRevealed(row.revealed);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "estimation_votes", filter: `session_id=eq.${sessionId}` },
          (payload) => {
            const row = payload.new as { issue_id: string; user_id: string; value: string } | undefined;
            if (!row || row.issue_id !== currentIssueId) return;
            setVotes((prev) => {
              const next = prev.filter((v) => v.userId !== row.user_id);
              next.push({ userId: row.user_id, value: row.value });
              return next;
            });
          }
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ userId: string; label: string }>();
          const others = Object.values(state)
            .flat()
            .filter((p) => p.userId !== meUserId)
            .reduce<Member[]>((acc, p) => {
              if (!acc.find((x) => x.userId === p.userId)) acc.push({ userId: p.userId, label: p.label });
              return acc;
            }, []);
          setPresentUsers(others);
        })
        .subscribe(async (subStatus) => {
          if (subStatus === "SUBSCRIBED") await channel!.track({ userId: meUserId, label: meLabel });
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentIssueId]);

  function vote(value: string) {
    if (!currentIssueId) return;
    setError(null);
    startTransition(async () => {
      try { await castVoteAction(slug, sessionId, currentIssueId, value); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to vote"); }
    });
  }

  function reveal() {
    setError(null);
    startTransition(async () => {
      try { await revealVotesAction(slug, sessionId); setRevealed(true); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to reveal"); }
    });
  }

  function applyAndNext() {
    if (!currentIssueId) return;
    const parsed = parseFloat(applyPoints);
    if (Number.isNaN(parsed)) { setError("Enter a valid number of points first."); return; }
    setError(null);
    startTransition(async () => {
      try { await applyPointsAction(slug, sessionId, projectId, currentIssueId, parsed); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to apply points"); }
    });
  }

  function skip() {
    if (!currentIssueId) return;
    setError(null);
    startTransition(async () => {
      try { await skipIssueAction(slug, sessionId, projectId, currentIssueId); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to skip"); }
    });
  }

  function endSession() {
    startTransition(async () => {
      try { await endSessionAction(slug, sessionId); router.push(`/${slug}/estimation-poker?project=${projectId}`); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to end session"); }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Estimation Poker</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {presentUsers.length > 0 && (
            <div className="flex -space-x-2">
              {presentUsers.slice(0, 5).map((u) => (
                <span key={u.userId} title={u.label} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {u.label.slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <button onClick={endSession} disabled={pending} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
            End session
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {status === "completed" && !issue ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-semibold text-emerald-800">Session complete 🎉</p>
          <p className="mt-1 text-sm text-emerald-700">Every issue in this project now has story points, or the session was ended.</p>
        </div>
      ) : !issue ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">Loading next issue…</div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-mono">{project.key}-{issue.number}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5">{typeMap.get(issue.type) ?? issue.type}</span>
              {priMap.get(issue.priority) && (
                <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: priMap.get(issue.priority)!.color ?? "#9CA3AF" }}>
                  {priMap.get(issue.priority)!.label}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">{issue.title}</h2>
            {issue.description && (
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-neutral-600">{issue.description}</p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {revealed ? "Votes revealed" : `${votes.length} of ${presentUsers.length + 1} voted`}
              </p>
              {!revealed && (
                <button onClick={reveal} disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  Reveal votes
                </button>
              )}
            </div>

            {!revealed ? (
              <div className="flex flex-wrap gap-2">
                {DECK.map((card) => (
                  <button
                    key={card}
                    onClick={() => vote(card)}
                    disabled={pending}
                    className={`h-14 w-11 rounded-lg border-2 text-lg font-bold transition-colors disabled:opacity-50 ${
                      myVote === card ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    {card}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {votes.map((v) => (
                    <div key={v.userId} className="flex flex-col items-center gap-1">
                      <div className="flex h-14 w-11 items-center justify-center rounded-lg border-2 border-neutral-200 text-lg font-bold text-neutral-800">
                        {v.value}
                      </div>
                      <span className="max-w-[3.5rem] truncate text-[10px] text-neutral-400">{memberMap.get(v.userId) ?? "?"}</span>
                    </div>
                  ))}
                  {votes.length === 0 && <p className="text-sm text-neutral-400">Nobody voted this round.</p>}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
                  <label className="text-xs font-medium text-neutral-600">Apply as story points:</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={applyPoints}
                    onChange={(e) => setApplyPoints(e.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
                  />
                  <button onClick={applyAndNext} disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                    Apply &amp; next
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-3">
            <button onClick={skip} disabled={pending} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
              Skip this issue
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Median of numeric votes, ignoring "?" — a defensible single-number suggestion without pretending non-numeric votes have a value. */
function medianVote(votes: Vote[]): number | null {
  const nums = votes.map((v) => parseFloat(v.value)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}
