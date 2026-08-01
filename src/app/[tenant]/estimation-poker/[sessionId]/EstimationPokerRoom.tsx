"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { castVoteAction, revealVotesAction, applyPointsAction, skipIssueAction, endSessionAction } from "../actions";
import PageHeader from "@/components/patterns/PageHeader";
import Note from "@/components/patterns/admin/Note";
import PokerDeck from "@/components/patterns/admin/PokerDeck";
import AdminList from "@/components/patterns/admin/AdminList";

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
    <div>
      <PageHeader
        title="Estimation Poker"
        subtitle={project.name}
        right={
          <div className="flex items-center gap-2">
            {presentUsers.length > 0 && (
              <div className="flex -space-x-2">
                {presentUsers.slice(0, 5).map((u) => (
                  <span key={u.userId} title={u.label} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f4f2eb] bg-[#f3e4dd] text-[10px] font-bold text-[#8c4632]">
                    {u.label.slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={endSession}
              disabled={pending}
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-[7px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50"
            >
              End session
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-2xl space-y-4 px-6 py-5">
        {error && <p className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</p>}

        {status === "completed" && !issue ? (
          <div className="rounded-[6px] border border-[#c9d9c9] bg-[#e9f3ea] px-6 py-10 text-center">
            <p className="text-[15px] font-extrabold font-[family-name:var(--font-manrope)] text-[#3f7d4c]">Session complete 🎉</p>
            <p className="mt-1 text-[12.5px] text-[#3f7d4c]">Every issue in this project now has story points, or the session was ended.</p>
          </div>
        ) : !issue ? (
          <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">Loading next issue…</div>
        ) : (
          <>
            <div className="fw-card px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] text-[#a19d90]">
                <span className="font-mono">{project.key}-{issue.number}</span>
                <span className="rounded bg-[#e3ded0] px-1.5 py-0.5">{typeMap.get(issue.type) ?? issue.type}</span>
                {priMap.get(issue.priority) && (
                  <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: priMap.get(issue.priority)!.color ?? "#a19d90" }}>
                    {priMap.get(issue.priority)!.label}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-[15px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">{issue.title}</h2>
              {issue.description && (
                <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-[12.5px] text-[#4a473e]">{issue.description}</p>
              )}
            </div>

            <Note icon="🃏" tone="info">
              {project.key}-{issue.number} · {issue.title} — {revealed ? "votes revealed." : `${votes.length} of ${presentUsers.length + 1} voted.`}
            </Note>

            <div className="fw-card px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
                  {revealed ? "Votes revealed" : "Your estimate"}
                </p>
                {!revealed && (
                  <button
                    onClick={reveal}
                    disabled={pending}
                    className="rounded-[5px] border border-[#5e2c1f] px-3 py-[6px] text-[11.5px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                    style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                  >
                    Reveal votes
                  </button>
                )}
              </div>

              {!revealed ? (
                <PokerDeck values={DECK} selected={myVote} onSelect={(v) => vote(String(v))} />
              ) : (
                <>
                  <AdminList
                    items={[
                      ...votes.map((v) => ({ key: v.userId, title: memberMap.get(v.userId) ?? "?", meta: v.value })),
                      ...(votes.length === 0 ? [{ key: "none", title: "Nobody voted this round." }] : []),
                    ]}
                  />

                  <div className="mt-4 flex items-center gap-2 border-t border-[#e3ded0] pt-4">
                    <label className="text-[11.5px] font-semibold text-[#4a473e]">Apply as story points:</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={applyPoints}
                      onChange={(e) => setApplyPoints(e.target.value)}
                      className="w-20 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] outline-none focus:border-[#b7452f]"
                    />
                    <button
                      onClick={applyAndNext}
                      disabled={pending}
                      className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                      style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                    >
                      Apply &amp; next
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={skip}
              disabled={pending}
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50"
            >
              Skip this issue
            </button>
          </>
        )}
      </div>
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
