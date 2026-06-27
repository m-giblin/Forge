"use client";

import { useState, useTransition } from "react";
import type { TicketComment } from "@/lib/repositories/ticketComments";
import {
  updateTicketStatusAction,
  updatePlatformNotesAction,
  addPlatformCommentAction,
  loadPlatformTicketCommentsAction,
  savePlatformStalledThresholdAction,
} from "./actions";

type Ticket = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  submitted_by: string | null;
  actor_label: string | null;
  title: string;
  body: string;
  status: string;
  priority: string;
  ai_triage_summary: string | null;
  ai_guidance: string | null;
  platform_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const STATUS_TABS = ["all", "open", "in_progress", "resolved"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-300",
  resolved: "bg-green-500/15 text-green-300",
  closed: "bg-neutral-700 text-neutral-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-300",
  urgent: "bg-red-500/25 text-red-200 font-semibold",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-neutral-700 text-neutral-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isStalled(ticket: Ticket, stalledDays: number): boolean {
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return (Date.now() - new Date(ticket.updated_at).getTime()) / 86400000 >= stalledDays;
}

function avgResolutionDays(tickets: Ticket[]): string {
  const resolved = tickets.filter((t) => t.resolved_at);
  if (!resolved.length) return "—";
  const avg = resolved.reduce((sum, t) => {
    return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 86400000;
  }, 0) / resolved.length;
  return avg < 1 ? `${Math.round(avg * 24)}h` : `${avg.toFixed(1)}d`;
}

// ── Stat tiles ────────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Stalled threshold setting ─────────────────────────────────────────────────
function StalledSetting({ current }: { current: number }) {
  const [val, setVal] = useState(String(current));
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span>Stalled after</span>
      <input
        type="number" min="1" max="30" value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-14 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-center text-neutral-100 text-xs outline-none focus:border-neutral-500"
      />
      <span>days</span>
      <button
        disabled={saving || !val || Number(val) < 1}
        onClick={() => {
          start(async () => {
            await savePlatformStalledThresholdAction(Number(val));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          });
        }}
        className="rounded-md bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600 transition disabled:opacity-40"
      >
        {saving ? "…" : saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}

// ── Ticket detail modal ───────────────────────────────────────────────────────
function TicketModal({
  ticket,
  stalledDays,
  onClose,
  onUpdate,
}: {
  ticket: Ticket;
  stalledDays: number;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Ticket>) => void;
}) {
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [replyPending, startReply] = useTransition();
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusPending, startStatus] = useTransition();
  const [notes, setNotes] = useState(ticket.platform_notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesPending, startNotes] = useTransition();
  const stalled = isStalled(ticket, stalledDays);

  async function loadComments() {
    setLoading(true);
    try {
      const data = await loadPlatformTicketCommentsAction(ticket.id);
      setComments(data);
    } finally {
      setLoading(false);
    }
  }

  if (comments === null && !loading) loadComments();

  function sendReply() {
    if (!reply.trim()) return;
    setReplyError(null);
    startReply(async () => {
      const res = await addPlatformCommentAction(ticket.id, reply.trim(), isInternal);
      if (res.ok) {
        setReply("");
        await loadComments();
      } else {
        setReplyError(res.error ?? "Failed.");
      }
    });
  }

  function changeStatus(status: string) {
    startStatus(async () => {
      await updateTicketStatusAction(ticket.id, status);
      onUpdate(ticket.id, { status, updated_at: new Date().toISOString(), ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}) });
    });
  }

  function saveNotes() {
    startNotes(async () => {
      await updatePlatformNotesAction(ticket.id, notes);
      onUpdate(ticket.id, { platform_notes: notes });
      setEditingNotes(false);
    });
  }

  const NEXT_STATUSES = ["open", "in_progress", "resolved", "closed"].filter((s) => s !== ticket.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>
              {stalled && (
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-300">⚠ Stalled</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-700 text-neutral-400"}`}>
                {ticket.priority}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{ticket.title}</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {ticket.tenant_name ?? "—"} {ticket.tenant_slug && <span className="font-mono">/{ticket.tenant_slug}</span>}
              {" "}· {ticket.actor_label ?? "Unknown"} · {timeAgo(ticket.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Request */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <p className="text-xs font-medium text-neutral-400 mb-2">Request</p>
            <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500">Move to:</span>
            {NEXT_STATUSES.map((s) => (
              <button key={s} onClick={() => changeStatus(s)} disabled={statusPending}
                className="rounded-lg border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300 hover:border-neutral-500 hover:text-white transition disabled:opacity-40">
                {STATUS_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          {/* AI triage */}
          {(ticket.ai_triage_summary || ticket.ai_guidance) && (
            <div className="rounded-xl bg-indigo-950/40 border border-indigo-900/50 p-4 space-y-2">
              {ticket.ai_triage_summary && (
                <div>
                  <p className="text-xs font-semibold text-indigo-400 mb-1">✨ AI Triage</p>
                  <p className="text-xs text-neutral-300 leading-relaxed">{ticket.ai_triage_summary}</p>
                </div>
              )}
              {ticket.ai_guidance && (
                <div>
                  <p className="text-xs font-semibold text-indigo-400 mb-1">Suggested guidance</p>
                  <p className="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed">{ticket.ai_guidance}</p>
                </div>
              )}
            </div>
          )}

          {/* Thread */}
          <div>
            <p className="text-xs font-medium text-neutral-400 mb-3">Thread</p>
            {loading ? (
              <p className="text-sm text-neutral-500 text-center py-4">Loading…</p>
            ) : comments?.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No replies yet.</p>
            ) : (
              <div className="space-y-3">
                {comments?.map((c) => (
                  <div key={c.id} className={`rounded-xl px-4 py-3 text-sm border ${
                    c.is_internal ? "bg-amber-950/30 border-amber-800/40" : "bg-neutral-800 border-neutral-700"
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-neutral-400">{c.author_label ?? "Unknown"}</span>
                      <div className="flex items-center gap-2">
                        {c.is_internal && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">internal</span>
                        )}
                        <span className="text-xs text-neutral-600">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-neutral-200 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform notes */}
          <div className="rounded-xl bg-neutral-800/50 border border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-neutral-400">Platform Notes (internal)</p>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-neutral-500 hover:text-neutral-300 transition">
                  Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-neutral-500 resize-none" />
                <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={notesPending}
                    className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-neutral-900 disabled:opacity-40">
                    {notesPending ? "…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingNotes(false); setNotes(ticket.platform_notes ?? ""); }}
                    className="text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">
                {ticket.platform_notes || <span className="text-neutral-600">None</span>}
              </p>
            )}
          </div>
        </div>

        {/* Reply */}
        <div className="px-6 py-4 border-t border-neutral-800 space-y-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer select-none">
            <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded border-neutral-600" />
            Internal note (not visible to submitter)
          </label>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={isInternal ? "Internal note…" : "Reply to submitter…"} rows={3}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none ${
              isInternal
                ? "border-amber-700/50 bg-amber-950/20 text-amber-100 placeholder-amber-800 focus:border-amber-600"
                : "border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-600 focus:border-neutral-500"
            }`}
          />
          {replyError && <p className="text-xs text-red-400">{replyError}</p>}
          <div className="flex justify-end">
            <button onClick={sendReply} disabled={replyPending || !reply.trim()}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40">
              {replyPending ? "Sending…" : isInternal ? "Save Note" : "Send Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SupportConsole({
  tickets: initialTickets,
  stalledDays,
}: {
  tickets: Ticket[];
  stalledDays: number;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [tab, setTab] = useState<StatusTab>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  function handleUpdate(id: string, patch: Partial<Ticket>) {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    if (selectedTicket?.id === id) setSelectedTicket((s) => s ? { ...s, ...patch } : s);
  }

  const stalled = tickets.filter((t) => isStalled(t, stalledDays));
  const filtered = tab === "all" ? tickets : tickets.filter((t) => t.status === tab);
  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  // By-tenant breakdown
  const byTenant = Array.from(
    tickets.reduce((m, t) => {
      const key = t.tenant_name ?? t.tenant_id;
      m.set(key, (m.get(key) ?? 0) + 1);
      return m;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="mt-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Open" value={open} accent={open > 0 ? "text-blue-300" : "text-white"} />
        <StatTile label="In Progress" value={inProgress} accent={inProgress > 0 ? "text-amber-300" : "text-white"} />
        <StatTile label="Stalled" value={stalled.length} accent={stalled.length > 0 ? "text-orange-300" : "text-white"} />
        <StatTile label="Resolved" value={resolved} accent="text-green-300" />
        <StatTile label="Avg Resolution" value={avgResolutionDays(tickets)} />
      </div>

      {/* Settings + tenant breakdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <StalledSetting current={stalledDays} />
        {byTenant.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>Top tenants:</span>
            {byTenant.map(([name, count]) => (
              <span key={name} className="text-neutral-300">{name} <span className="text-neutral-600">({count})</span></span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 w-fit">
        {STATUS_TABS.map((t) => {
          const count = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}>
              {t === "all" ? "All" : STATUS_LABELS[t] ?? t}{" "}
              <span className="ml-1 text-xs text-neutral-500">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No tickets in this category.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => {
                const stall = isStalled(ticket, stalledDays);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="border-b border-neutral-800/60 last:border-0 cursor-pointer hover:bg-neutral-800/30 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="text-neutral-200">{ticket.tenant_name ?? "—"}</div>
                      {ticket.tenant_slug && (
                        <div className="font-mono text-xs text-neutral-500">/{ticket.tenant_slug}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <div className="flex items-center gap-2">
                        {stall && (
                          <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">Stalled</span>
                        )}
                        <span className="text-neutral-100 truncate">{ticket.title}</span>
                      </div>
                      {ticket.actor_label && (
                        <div className="text-xs text-neutral-500 truncate mt-0.5">{ticket.actor_label}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-700 text-neutral-400"}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[ticket.status] ?? "bg-neutral-700 text-neutral-400"}`}>
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {timeAgo(ticket.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          stalledDays={stalledDays}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
