"use client";

import { useState, useTransition } from "react";
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

function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.ceil((new Date(end + "T00:00:00").getTime() - Date.now()) / 86_400_000);
}

function BurnDown({ startDate, endDate, total, done }: {
  startDate: string; endDate: string; total: number; done: number;
}) {
  const W = 260, H = 80, pad = 4;
  const start = new Date(startDate + "T00:00:00").getTime();
  const end   = new Date(endDate   + "T00:00:00").getTime();
  const now   = Math.min(Date.now(), end);
  const span  = Math.max(1, end - start);
  const remaining = total - done;
  const xOf = (t: number) => pad + ((t - start) / span) * (W - pad * 2);
  const yOf = (v: number) => pad + ((total - v) / Math.max(1, total)) * (H - pad * 2);
  const ix0 = xOf(start), iy0 = yOf(total);
  const ix1 = xOf(end),   iy1 = yOf(0);
  const ax = xOf(now), ay = yOf(remaining);
  const projEndY = yOf(remaining > 0 ? Math.max(0, remaining - (remaining * (end - now) / Math.max(1, end - now))) : 0);
  const onTrack = remaining <= (total * (end - now) / Math.max(1, span));
  return (
    <div className="shrink-0" title={`Burn-down: ${done}/${total} done · ${remaining} remaining`}>
      <svg width={W} height={H} className="block">
        <line x1={ix0} y1={iy0} x2={ix1} y2={iy1} stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1={ax} y1={ay} x2={ix1} y2={projEndY} stroke={onTrack ? "#10b981" : "#f59e0b"} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
        <circle cx={ax} cy={ay} r="4" fill={onTrack ? "#10b981" : "#f59e0b"} />
        <line x1={ax} y1={pad} x2={ax} y2={H - pad} stroke="#d1d5db" strokeWidth="1" />
        <text x={ix0} y={H - 1} fontSize="9" fill="#9ca3af">Start</text>
        <text x={ix1 - 16} y={H - 1} fontSize="9" fill="#9ca3af">End</text>
        <text x={ax + 5} y={ay - 3} fontSize="9" fill={onTrack ? "#059669" : "#d97706"} fontWeight="600">{remaining} left</text>
      </svg>
      <p className="text-[10px] text-neutral-400 text-center -mt-1">
        {onTrack ? "✓ On track" : "⚠ Behind ideal"}
      </p>
    </div>
  );
}

type CreateTab = "single" | "bulk" | "import";

export default function SprintPanel({
  slug, projectId, activeSprint, plannedSprints, sprintIssues, backlogIssues,
  canEdit, estimatedMinutes = 0, loggedMinutes = 0,
}: {
  slug: string;
  projectId: string;
  activeSprint: Sprint | null;
  plannedSprints: Sprint[];
  sprintIssues: Issue[];
  backlogIssues: Issue[];
  canEdit: boolean;
  estimatedMinutes?: number;
  loggedMinutes?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab>("single");
  const [showBacklog, setShowBacklog] = useState(false);
  const [showPlanned, setShowPlanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit sprint inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Single sprint form
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const sprint = activeSprint ?? plannedSprints[0] ?? null;
  const done = sprintIssues.filter((i) => i.status === "done").length;
  const total = sprintIssues.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const days = sprint ? daysLeft(sprint.endDate) : null;

  function close() {
    setShowCreate(false);
    setError(null);
  }

  function createSingle() {
    setError(null);
    startTransition(async () => {
      try {
        await createSprintAction(slug, projectId, name || "Sprint", goal, startDate, endDate);
        close();
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

  const tabCls = (t: CreateTab) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
      createTab === t ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
    }`;

  const editForm = (
    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Goal</label>
          <input value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="(optional)"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Start date</label>
          <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">End date</label>
          <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
      </div>
      {editError && <p className="text-xs text-red-600">{editError}</p>}
      <div className="flex gap-2">
        <button onClick={saveSprint} disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditingId(null)}
          className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="mb-4 space-y-2">
      {/* Sprint banner */}
      {sprint ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                sprint.status === "active" ? "bg-emerald-100 text-emerald-700" :
                sprint.status === "planned" ? "bg-blue-100 text-blue-700" :
                "bg-neutral-100 text-neutral-500"
              }`}>
                {sprint.status === "active" ? "Active sprint" : sprint.status === "planned" ? "Planned" : "Completed"}
              </span>
              <span className="font-semibold text-neutral-900 truncate">{sprint.name}</span>
              {sprint.goal && <span className="hidden sm:block text-sm text-neutral-500 truncate">— {sprint.goal}</span>}
              {sprint.startDate && (
                <span className="hidden sm:block text-xs text-neutral-400">
                  {fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}
                  {days !== null && sprint.status === "active" && (
                    <span className={`ml-1 font-medium ${days < 0 ? "text-red-600" : days <= 2 ? "text-amber-600" : "text-neutral-500"}`}>
                      {days < 0 ? `(${-days}d overdue)` : days === 0 ? "(ends today)" : `(${days}d left)`}
                    </span>
                  )}
                </span>
              )}
              {canEdit && editingId !== sprint.id && (
                <button
                  onClick={() => openEdit(sprint)}
                  title="Edit sprint"
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400 transition"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L4 15H1v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {total > 0 && (
                <div className="flex items-center gap-2" title={`${done} of ${total} issues done`}>
                  <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-neutral-500">{done}/{total} issues</span>
                </div>
              )}
              {estimatedMinutes > 0 && (() => {
                const estH = (estimatedMinutes / 60).toFixed(1);
                const logH = (loggedMinutes / 60).toFixed(1);
                const burnPct = Math.min(100, Math.round((loggedMinutes / estimatedMinutes) * 100));
                const over = loggedMinutes > estimatedMinutes;
                return (
                  <div className="flex items-center gap-2" title={`${logH}h logged of ${estH}h estimated`}>
                    <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all ${over ? "bg-red-400" : "bg-indigo-400"}`} style={{ width: `${burnPct}%` }} />
                    </div>
                    <span className={`text-xs ${over ? "text-red-600 font-medium" : "text-neutral-500"}`}>{logH}h / {estH}h</span>
                  </div>
                );
              })()}
              {canEdit && sprint.status === "planned" && (
                <button onClick={() => startSprint(sprint.id)} disabled={pending}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                  Start sprint
                </button>
              )}
              {canEdit && sprint.status === "active" && (
                <button onClick={() => completeSprint(sprint.id)} disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                  Complete sprint
                </button>
              )}
            </div>
          </div>

          {editingId === sprint.id && editForm}

          {sprint.status === "active" && total > 0 && sprint.startDate && sprint.endDate && (
            <div className="mt-3 pt-2 border-t border-neutral-100">
              <BurnDown startDate={sprint.startDate} endDate={sprint.endDate} total={total} done={done} />
            </div>
          )}

          {(sprint.status === "active" || sprint.status === "completed") && (() => {
            const sprintDays = sprint.startDate && sprint.endDate
              ? Math.ceil((new Date(sprint.endDate + "T00:00:00").getTime() - new Date(sprint.startDate + "T00:00:00").getTime()) / 86_400_000)
              : null;
            return (
              <SprintIntelligence
                slug={slug}
                sprintId={sprint.id}
                issueCount={sprintIssues.length}
                sprintDays={sprintDays}
              />
            );
          })()}

          {sprint.status === "active" && sprintIssues.length > 0 && canEdit && (
            <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
              {sprintIssues.slice(0, 8).map((i) => (
                <button key={i.id} onClick={() => removeFromSprint(i.id)} title="Remove from sprint"
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 hover:bg-red-50 hover:text-red-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${i.status === "done" ? "bg-emerald-500" : "bg-neutral-400"}`} />
                  {i.title.length > 30 ? i.title.slice(0, 30) + "…" : i.title}
                  <span className="text-neutral-300">×</span>
                </button>
              ))}
              {sprintIssues.length > 8 && <span className="text-xs text-neutral-400">+{sprintIssues.length - 8} more</span>}
            </div>
          )}
        </div>
      ) : null}

      {/* Planned sprints — collapsed by default */}
      {plannedSprints.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <button
            onClick={() => setShowPlanned((s) => !s)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-neutral-50 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-base text-neutral-500">{showPlanned ? "▾" : "▸"}</span>
              <span className="text-xs font-semibold text-neutral-600">Upcoming Sprints</span>
            </div>
            <span className="text-xs text-neutral-400">{plannedSprints.length} planned</span>
          </button>
          {showPlanned && <div className="border-t border-neutral-100" />}
          {showPlanned && plannedSprints.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="border-t border-neutral-100" />}
              {editingId === s.id ? (
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-500 mb-1 block">Name</label>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 mb-1 block">Goal</label>
                      <input value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="(optional)"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 mb-1 block">Start date</label>
                      <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-500 mb-1 block">End date</label>
                      <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                  </div>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveSprint} disabled={pending}
                      className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Planned</span>
                  <span className="font-medium text-neutral-800 text-sm truncate">{s.name}</span>
                  {s.goal && <span className="hidden sm:block text-xs text-neutral-400 truncate">— {s.goal}</span>}
                  {s.startDate && (
                    <span className="hidden sm:block text-xs text-neutral-400 shrink-0">
                      {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => openEdit(s)}
                          className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400 transition"
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L4 15H1v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => startSprint(s.id)}
                          disabled={pending || !!activeSprint}
                          title={activeSprint ? "Complete the active sprint first" : "Start this sprint"}
                          className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Start
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* + Create sprint */}
      {canEdit && !showCreate && (
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-700">
          + Create sprint
        </button>
      )}

      {showCreate && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button className={tabCls("single")} onClick={() => { setCreateTab("single"); setError(null); }}>Single</button>
              <button className={tabCls("bulk")} onClick={() => { setCreateTab("bulk"); setError(null); }}>Bulk scaffold</button>
              <button className={tabCls("import")} onClick={() => { setCreateTab("import"); setError(null); }}>AI import</button>
            </div>
            <button onClick={close} className="text-neutral-400 hover:text-neutral-600 text-sm">✕</button>
          </div>

          {createTab === "single" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">Goal (optional)</label>
                  <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ship user auth"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">Start date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">End date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={createSingle} disabled={pending}
                  className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                  {pending ? "Creating…" : "Create"}
                </button>
                <button onClick={close} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
              </div>
            </div>
          )}

          {createTab === "bulk" && (
            <BulkSprintCreator
              slug={slug}
              projectId={projectId}
              onClose={close}
              onDone={close}
            />
          )}

          {createTab === "import" && (
            <SprintImport
              slug={slug}
              projectId={projectId}
              onClose={close}
              onDone={close}
            />
          )}
        </div>
      )}

      {/* Backlog toggle */}
      {canEdit && backlogIssues.length > 0 && sprint && sprint.status !== "completed" && (
        <div>
          <button onClick={() => setShowBacklog((s) => !s)} className="text-xs text-neutral-400 hover:text-neutral-600">
            {showBacklog ? "▾" : "▸"} Backlog ({backlogIssues.length} unscheduled)
          </button>
          {showBacklog && (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-xs text-neutral-500">Click + to add to the current sprint</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {backlogIssues.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-neutral-100">
                    <span className="truncate text-neutral-700">{i.title}</span>
                    <button onClick={() => addToSprint(i.id)} disabled={pending}
                      className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900 disabled:opacity-50">
                      + sprint
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
