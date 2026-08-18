"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Sprint } from "@/lib/repositories/sprints";
import type { Issue } from "@/lib/repositories/issues";
import {
  createSprintAction,
  startSprintAction,
  completeSprintAction,
  addIssueToSprintAction,
  removeIssueFromSprintAction,
  updateSprintAction,
} from "./sprintActions";
import SprintIntelligence from "./SprintIntelligence";
import BulkSprintCreator from "./BulkSprintCreator";
import SprintImport from "./SprintImport";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function currentMs() {
  return Date.now();
}

function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.ceil((new Date(end + "T00:00:00").getTime() - currentMs()) / 86_400_000);
}

/**
 * Small inline sparkline — not a full chart. The real burndown chart lives in
 * Reports. `nowMs` is passed in (rather than read via Date.now() during
 * render) to keep this component pure per React's render-purity rules.
 */
function BurnSparkline({ startDate, endDate, total, done, nowMs }: {
  startDate: string; endDate: string; total: number; done: number; nowMs: number;
}) {
  const W = 120, H = 42, pad = 3;
  const start = new Date(startDate + "T00:00:00").getTime();
  const end = new Date(endDate + "T00:00:00").getTime();
  const now = Math.min(Math.max(nowMs, start), end);
  const span = Math.max(1, end - start);
  const remaining = total - done;
  const xOf = (t: number) => pad + ((t - start) / span) * (W - pad * 2);
  const yOf = (v: number) => pad + ((total - v) / Math.max(1, total)) * (H - pad * 2);
  const ix0 = xOf(start), iy0 = yOf(total);
  const ix1 = xOf(end), iy1 = yOf(0);
  const ax = xOf(now), ay = yOf(remaining);
  const onTrack = remaining <= (total * (end - now) / Math.max(1, span));
  return (
    <svg width={W} height={H} className="block">
      <line x1={ix0} y1={iy0} x2={ix1} y2={iy1} stroke="#ddd8c9" strokeWidth="1.25" strokeDasharray="3 2" />
      <circle cx={ax} cy={ay} r="3" fill={onTrack ? "#3f7d4c" : "#c9791d"} />
      <line x1={ax} y1={pad} x2={ax} y2={H - pad} stroke="#ddd8c9" strokeWidth="1" />
    </svg>
  );
}

type CreateTab = "single" | "bulk" | "import";
type Warning = { key: string; text: string; actionLabel: string; onAction: () => void };

export default function SprintPanel({
  slug, projectId, activeSprint, plannedSprints, sprintIssues, backlogIssues, unassignedOverdue,
  canEdit, estimatedMinutes = 0, loggedMinutes = 0,
}: {
  slug: string;
  projectId: string;
  activeSprint: Sprint | null;
  plannedSprints: Sprint[];
  sprintIssues: Issue[];
  backlogIssues: Issue[];
  unassignedOverdue: Issue[];
  canEdit: boolean;
  estimatedMinutes?: number;
  loggedMinutes?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab | null>(null);
  const [showBacklog, setShowBacklog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertExpanded, setAlertExpanded] = useState(false);

  // URL-backed (not localStorage) so it survives opening an issue and coming
  // back — same reasoning as Board.tsx's quick filters and collapsed columns.
  const detailsOpen = searchParams.get("details") === "1";
  function toggleDetails() {
    const next = new URLSearchParams(searchParams.toString());
    if (detailsOpen) next.delete("details"); else next.set("details", "1");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const sprint = activeSprint ?? plannedSprints[0] ?? null;
  const done = sprintIssues.filter((i) => i.status === "done").length;
  const total = sprintIssues.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const days = sprint ? daysLeft(sprint.endDate) : null;

  function closeCreate() {
    setCreateTab(null);
    setError(null);
  }

  function createSingle() {
    setError(null);
    startTransition(async () => {
      try {
        await createSprintAction(slug, projectId, name || "Sprint", goal, startDate, endDate);
        closeCreate();
        setName(""); setGoal(""); setStartDate(""); setEndDate("");
      } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    });
  }

  function startSprint(id: string) { startTransition(() => startSprintAction(slug, id)); }
  function completeSprint(id: string) {
    if (!confirm("Complete this sprint? Unfinished issues will move to the backlog.")) return;
    startTransition(() => completeSprintAction(slug, id));
  }
  function addToSprint(issueId: string) {
    if (!sprint) return;
    startTransition(() => addIssueToSprintAction(slug, sprint.id, issueId));
  }
  function removeFromSprint(issueId: string) { startTransition(() => removeIssueFromSprintAction(slug, issueId)); }

  function openEdit(s: Sprint) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditGoal(s.goal ?? "");
    setEditStart(s.startDate ?? "");
    setEditEnd(s.endDate ?? "");
    setEditError(null);
  }

  function saveSprint() {
    if (!editingId) return;
    setEditError(null);
    startTransition(async () => {
      try {
        await updateSprintAction(slug, editingId, { name: editName, goal: editGoal, startDate: editStart, endDate: editEnd });
        setEditingId(null);
      } catch (e) { setEditError(e instanceof Error ? e.message : "Failed to save"); }
    });
  }

  // ── Consolidated alert bar — every warning collapses into ONE row.
  // This is the single alert bar for the whole board page (this component
  // is the only one that renders one — Board.tsx used to have its own
  // separate "unassigned past SLA" banner stacked on top of this one,
  // which is exactly the "two pink bars" clutter this was supposed to
  // avoid; that signal now lives here instead, as just another warning). ──
  const warnings: Warning[] = [];
  if (unassignedOverdue.length > 0) {
    warnings.push({
      key: "unassigned-overdue",
      text: `${unassignedOverdue.length} ticket${unassignedOverdue.length > 1 ? "s" : ""} unassigned past SLA.`,
      actionLabel: "Review oldest",
      onAction: () => router.push(`/${slug}/issues/${unassignedOverdue[0].id}`),
    });
  }
  if (sprint && sprint.status === "active") {
    if (days !== null && days <= 2 && total > 0 && done < total) {
      warnings.push({
        key: "ending",
        text: days < 0 ? `Sprint is ${-days}d overdue with ${total - done} issue${total - done > 1 ? "s" : ""} still open.` : `Sprint ends ${days === 0 ? "today" : `in ${days}d`} with ${total - done} issue${total - done > 1 ? "s" : ""} still open.`,
        actionLabel: days < 0 ? "Complete sprint" : "Extend dates",
        onAction: () => (days < 0 ? completeSprint(sprint.id) : openEdit(sprint)),
      });
    }
    if (estimatedMinutes > 0 && loggedMinutes > estimatedMinutes) {
      warnings.push({
        key: "over-capacity",
        text: `Logged time (${(loggedMinutes / 60).toFixed(1)}h) has exceeded the sprint estimate (${(estimatedMinutes / 60).toFixed(1)}h).`,
        actionLabel: "Review",
        onAction: () => setAlertExpanded(true),
      });
    }
  }

  const editForm = (
    <div className="mt-3 space-y-3 border-t border-[#e3ded0] pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#8c4632]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Goal</label>
          <input value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="(optional)"
            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#8c4632]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Start date</label>
          <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#8c4632]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">End date</label>
          <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#8c4632]" />
        </div>
      </div>
      {editError && <p className="text-[11px] text-[#c0392b]">{editError}</p>}
      <div className="flex gap-2">
        <button onClick={saveSprint} disabled={pending}
          className="rounded-lg bg-[#8c4632] px-4 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#7a3c2a] disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditingId(null)}
          className="rounded-lg border border-[var(--fw-cream-border)] px-4 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="border-b border-[var(--fw-cream-border)] bg-[var(--fw-cream-bg)]">
      {/* ── Sticky one-row header ── */}
      <div className="flex items-center gap-3 px-6 py-2" style={{ minHeight: 40 }}>
        {sprint ? (
          <>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] ${
              sprint.status === "active" ? "border-[#cbe2cf] bg-[#e9f3ea] text-[#3f7d4c]" :
              sprint.status === "planned" ? "border-[#c9dceb] bg-[#eaf1f8] text-[#3a6ea8]" :
              "border-[#e3ded0] bg-[#f1efe9] text-[#a19d90]"
            }`}>
              {sprint.status === "active" ? "Active" : sprint.status === "planned" ? "Planned" : "Completed"}
            </span>
            <span className="shrink-0 font-[family-name:var(--font-manrope)] text-[21px] font-extrabold leading-none text-[#20201d]">
              {sprint.name}
            </span>
            {sprint.goal && (
              <span className="min-w-0 flex-1 truncate text-[12px] text-[#726e60]">{sprint.goal}</span>
            )}

            <button
              onClick={() => setDropdownOpen((v) => !v)}
              aria-label="Switch sprint"
              className="flex shrink-0 items-center justify-center rounded-md px-1 text-[#a19d90] hover:bg-[#eae6da] hover:text-[#4a473e]"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: dropdownOpen ? "rotate(180deg)" : undefined }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {sprint.startDate && (
              <span className="hidden shrink-0 items-center gap-1 text-[11px] text-[#a19d90] sm:flex">
                🗓️ {fmtDate(sprint.startDate)}–{fmtDate(sprint.endDate)}
                {days !== null && sprint.status === "active" && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${days < 0 ? "bg-[#fbeae8] text-[#c0392b]" : days <= 2 ? "bg-[#fdf1de] text-[#c9791d]" : ""}`}>
                    {days < 0 ? `${-days}d overdue` : days === 0 ? "ends today" : `${days}d left`}
                  </span>
                )}
              </span>
            )}

            {total > 0 && (
              <span className="hidden shrink-0 items-center gap-2 md:flex">
                <span className="block overflow-hidden rounded-full bg-[#e3ded0]" style={{ width: 96, height: 6 }}>
                  <span className="block h-full rounded-full bg-[#3f7d4c] transition-all" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-[11px] text-[#a19d90]">{done}/{total} done</span>
              </span>
            )}

            <span className="flex-1" />

            <button
              onClick={toggleDetails}
              className={`shrink-0 rounded-full border px-[11px] py-[6px] text-[11.5px] font-semibold transition-colors ${
                detailsOpen ? "border-[#8c4632] bg-[#8c4632] text-[#f2e9d8]" : "border-[var(--fw-cream-border)] bg-[var(--fw-cream)] text-[#4a473e] hover:bg-[#eae6da]"
              }`}
            >
              Sprint details
            </button>

            {canEdit && (
              <button
                onClick={() => { setDropdownOpen(true); openEdit(sprint); }}
                className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
              >
                Edit
              </button>
            )}

            {canEdit && sprint.status === "planned" && (
              <button onClick={() => startSprint(sprint.id)} disabled={pending}
                className="shrink-0 rounded-full bg-[#8c4632] px-[11px] py-[6px] text-[11.5px] font-semibold text-white hover:bg-[#7a3c2a] disabled:opacity-50">
                Start sprint
              </button>
            )}
            {canEdit && sprint.status === "active" && (
              <button onClick={() => completeSprint(sprint.id)} disabled={pending}
                className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50">
                Complete sprint
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-[12.5px] text-[#726e60]">No sprint yet for this project.</span>
            <span className="flex-1" />
            {canEdit && (
              <button onClick={() => setDropdownOpen((v) => !v)}
                className="shrink-0 rounded-full bg-[#8c4632] px-[11px] py-[6px] text-[11.5px] font-semibold text-white hover:bg-[#7a3c2a]">
                + Create sprint
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Sprint dropdown — replaces the old sprint-pill row ── */}
      {dropdownOpen && (
        <div className="border-t border-[var(--fw-cream-border)] bg-white px-6 py-3 shadow-sm">
          <p className="mb-2 -mx-6 border-b border-[var(--fw-cream-border)] bg-[#f4f2eb] px-6 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">
            Sprints · {1 + plannedSprints.filter((s) => s.id !== sprint?.id).length}
          </p>
          {editingId === sprint?.id && sprint && editForm}

          {plannedSprints.filter((s) => s.id !== sprint?.id).length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Upcoming sprints</p>
              <div className="fw-card overflow-hidden">
                {plannedSprints.filter((s) => s.id !== sprint?.id).map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                    <span className="shrink-0 rounded-full bg-[#eaf1f8] px-2 py-0.5 text-[10px] font-bold text-[#3a6ea8]">Planned</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#20201d]">{s.name}</span>
                    {s.startDate && <span className="hidden shrink-0 text-[11px] text-[#a19d90] sm:block">{fmtDate(s.startDate)}–{fmtDate(s.endDate)}</span>}
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => openEdit(s)} className="text-[11px] font-semibold text-[#a19d90] hover:text-[#4a473e]">Edit</button>
                        <button onClick={() => startSprint(s.id)} disabled={pending || !!activeSprint}
                          title={activeSprint ? "Complete the active sprint first" : "Start this sprint"}
                          className="rounded-full bg-[#8c4632] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
                          Start
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {editingId && editingId !== sprint?.id && editForm}
            </div>
          )}

          {canEdit && (
            <div className="mb-3">
              {createTab === null ? (
                <button onClick={() => setCreateTab("single")}
                  className="rounded-lg border border-dashed border-[var(--fw-cream-border)] px-4 py-2 text-[12px] text-[#726e60] hover:border-[#a19d90] hover:text-[#4a473e]">
                  + Create sprint
                </button>
              ) : (
                <div className="fw-card space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {(["single", "bulk", "import"] as CreateTab[]).map((t) => (
                        <button key={t} onClick={() => { setCreateTab(t); setError(null); }}
                          className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition ${createTab === t ? "bg-[#8c4632] text-white" : "text-[#726e60] hover:bg-[#eae6da]"}`}>
                          {t === "single" ? "Single" : t === "bulk" ? "Bulk scaffold" : "AI import"}
                        </button>
                      ))}
                    </div>
                    <button onClick={closeCreate} className="text-[#a19d90] hover:text-[#4a473e]">✕</button>
                  </div>

                  {createTab === "single" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Name</label>
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1"
                            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Goal (optional)</label>
                          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ship user auth"
                            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Start date</label>
                          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">End date</label>
                          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]" />
                        </div>
                      </div>
                      {error && <p className="text-[11px] text-[#c0392b]">{error}</p>}
                      <div className="flex gap-2">
                        <button onClick={createSingle} disabled={pending}
                          className="rounded-lg bg-[#8c4632] px-4 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#7a3c2a] disabled:opacity-50">
                          {pending ? "Creating…" : "Create"}
                        </button>
                        <button onClick={closeCreate} className="rounded-lg border border-[var(--fw-cream-border)] px-4 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]">Cancel</button>
                      </div>
                    </div>
                  )}

                  {createTab === "bulk" && (
                    <BulkSprintCreator slug={slug} projectId={projectId} onClose={closeCreate} onDone={closeCreate} />
                  )}
                  {createTab === "import" && (
                    <SprintImport slug={slug} projectId={projectId} onClose={closeCreate} onDone={closeCreate} />
                  )}
                </div>
              )}
            </div>
          )}

          {canEdit && backlogIssues.length > 0 && sprint && sprint.status !== "completed" && (
            <div>
              <button onClick={() => setShowBacklog((s) => !s)} className="text-[11.5px] font-semibold text-[#a19d90] hover:text-[#4a473e]">
                {showBacklog ? "▾" : "▸"} Backlog ({backlogIssues.length} unscheduled)
              </button>
              {showBacklog && (
                <div className="mt-2 max-h-48 overflow-y-auto fw-card">
                  {backlogIssues.map((i, idx) => (
                    <div key={i.id} className={`flex items-center justify-between gap-2 px-3.5 py-2 text-[12.5px] ${idx > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                      <span className="truncate text-[#20201d]">{i.title}</span>
                      <button onClick={() => addToSprint(i.id)} disabled={pending}
                        className="shrink-0 text-[11px] font-semibold text-[#a19d90] hover:text-[#8c4632] disabled:opacity-50">
                        + sprint
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Consolidated alert bar ── */}
      {warnings.length > 0 && (
        <div className="border-t" style={{ borderColor: "#f0cfc9", backgroundColor: "#fbeae8" }}>
          <button onClick={() => setAlertExpanded((v) => !v)} className="flex w-full items-center gap-2.5 px-6 py-2 text-left">
            <span className="shrink-0 text-[13px]">⚠️</span>
            <span className="shrink-0 text-[12px] font-bold text-[#c0392b]">
              {warnings.length} thing{warnings.length > 1 ? "s" : ""} need{warnings.length === 1 ? "s" : ""} your attention
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[#c0392b]">{warnings[0].text}</span>
            <span className="shrink-0 text-[11px] font-semibold text-[#c0392b]">{alertExpanded ? "Hide ▾" : "Review ▸"}</span>
          </button>
          {alertExpanded && (
            <div style={{ backgroundColor: "#fdf4f2" }}>
              {warnings.map((w, i) => (
                <div key={w.key} className={`flex items-center gap-2.5 py-2 pr-6 text-[12px] text-[#c0392b] ${i > 0 ? "border-t border-[#f0cfc9]" : ""}`} style={{ paddingLeft: 37 }}>
                  <span className="min-w-0 flex-1">{w.text}</span>
                  <button onClick={w.onAction} className="shrink-0 font-semibold underline hover:no-underline">{w.actionLabel}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sprint details panel — collapsed by default ── */}
      {detailsOpen && sprint && (
        <div className="border-t border-[var(--fw-cream-border)] px-6 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="fw-card p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Burndown</p>
              {sprint.startDate && sprint.endDate && total > 0 ? (
                <BurnSparkline startDate={sprint.startDate} endDate={sprint.endDate} total={total} done={done} nowMs={currentMs()} />
              ) : (
                <p className="mt-2 text-[11px] text-[#a19d90]">No data yet.</p>
              )}
            </div>
            <div className="fw-card p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Scope</p>
              <p className="mt-2 font-[family-name:var(--font-manrope)] text-[23px] font-extrabold text-[#20201d]">{done}/{total}</p>
              <p className="mt-0.5 text-[11px] text-[#a19d90]">issues done</p>
            </div>
            <div className="fw-card p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Capacity</p>
              {estimatedMinutes > 0 ? (
                <>
                  <p className="mt-2 font-[family-name:var(--font-manrope)] text-[23px] font-extrabold text-[#20201d]">
                    {(loggedMinutes / 60).toFixed(1)}h <span className="text-[13px] font-semibold text-[#a19d90]">/ {(estimatedMinutes / 60).toFixed(1)}h</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#a19d90]">logged / estimated</p>
                  <span className="mt-2 block overflow-hidden rounded-full bg-[#e3ded0]" style={{ height: 6 }}>
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((loggedMinutes / estimatedMinutes) * 100))}%`, backgroundColor: "#8c4632" }}
                    />
                  </span>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-[#a19d90]">No estimates logged.</p>
              )}
            </div>
            <div
              className="rounded-[6px] p-3.5 fw-grunge relative overflow-hidden border"
              style={{ background: "linear-gradient(160deg,#2a2c26,#20221d)", borderColor: "#454636" }}
            >
              <p className="relative text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a39d89]">AI Sprint Intelligence</p>
              <div className="relative mt-2">
                {(sprint.status === "active" || sprint.status === "completed") && sprint.startDate && sprint.endDate ? (
                  <SprintIntelligence
                    slug={slug}
                    sprintId={sprint.id}
                    issueCount={total}
                    sprintDays={Math.ceil((new Date(sprint.endDate + "T00:00:00").getTime() - new Date(sprint.startDate + "T00:00:00").getTime()) / 86_400_000)}
                  />
                ) : (
                  <p className="text-[11px] text-[#a39d89]">Available once the sprint is active.</p>
                )}
              </div>
            </div>
          </div>

          {sprint.status === "active" && sprintIssues.length > 0 && canEdit && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sprintIssues.slice(0, 8).map((i) => (
                <button key={i.id} onClick={() => removeFromSprint(i.id)} title="Remove from sprint"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--fw-cream)] px-2 py-0.5 text-[11px] text-[#4a473e] hover:bg-[#fbeae8] hover:text-[#c0392b]">
                  <span className={`h-1.5 w-1.5 rounded-full ${i.status === "done" ? "bg-[#3f7d4c]" : "bg-[#a19d90]"}`} />
                  {i.title.length > 30 ? i.title.slice(0, 30) + "…" : i.title}
                  <span className="text-[#a19d90]">×</span>
                </button>
              ))}
              {sprintIssues.length > 8 && <span className="text-[11px] text-[#a19d90]">+{sprintIssues.length - 8} more</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
