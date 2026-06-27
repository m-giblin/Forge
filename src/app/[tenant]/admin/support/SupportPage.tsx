"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@/lib/repositories/supportTickets";
import type { TicketComment } from "@/lib/repositories/ticketComments";
import {
  updateInternalTicketStatusAction,
  addAdminCommentAction,
  loadAdminTicketCommentsAction,
  submitPlatformTicketAction,
  saveTenantStalledThresholdAction,
} from "./actions";

const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  resolved: "bg-green-500/15 text-green-400",
  closed: "bg-neutral-700 text-neutral-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  urgent: "bg-red-500/25 text-red-300 font-semibold",
  medium: "bg-amber-500/15 text-amber-400",
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

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function isStalled(ticket: SupportTicket, stalledDays: number): boolean {
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return daysAgo(ticket.updated_at) >= stalledDays;
}

function avgResolutionDays(tickets: SupportTicket[]): string {
  const resolved = tickets.filter((t) => t.resolved_at);
  if (!resolved.length) return "—";
  const avg = resolved.reduce((sum, t) => {
    return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 86400000;
  }, 0) / resolved.length;
  return avg < 1 ? `${Math.round(avg * 24)}h` : `${avg.toFixed(1)}d`;
}

// ── Ticket detail modal ───────────────────────────────────────────────────────
function TicketModal({
  ticket,
  slug,
  stalledDays,
  onClose,
  onStatusChange,
}: {
  ticket: SupportTicket;
  slug: string;
  stalledDays: number;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusPending, startStatus] = useTransition();
  const stalled = isStalled(ticket, stalledDays);

  async function loadComments() {
    setLoading(true);
    try {
      const data = await loadAdminTicketCommentsAction(slug, ticket.id);
      setComments(data);
    } finally {
      setLoading(false);
    }
  }

  if (comments === null && !loading) loadComments();

  function sendReply() {
    if (!reply.trim()) return;
    setReplyError(null);
    startSubmit(async () => {
      const res = await addAdminCommentAction(slug, ticket.id, reply.trim(), isInternalNote);
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
      await updateInternalTicketStatusAction(slug, ticket.id, status);
      onStatusChange(ticket.id, status);
    });
  }

  const NEXT_STATUSES = ["open", "in_progress", "resolved", "closed"].filter((s) => s !== ticket.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                {STATUS_LABELS[ticket.status]}
              </span>
              {stalled && (
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-300">
                  ⚠ Stalled
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-700 text-neutral-400"}`}>
                {ticket.priority}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{ticket.title}</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {ticket.actor_label ?? "Unknown"} · {timeAgo(ticket.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Original request */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <p className="text-xs font-medium text-neutral-400 mb-2">Request</p>
            <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500">Move to:</span>
            {NEXT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={statusPending}
                className="rounded-lg border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300 hover:border-neutral-500 hover:text-white transition disabled:opacity-40"
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

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
                    c.is_internal
                      ? "bg-amber-950/30 border-amber-800/40"
                      : "bg-neutral-800 border-neutral-700"
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
        </div>

        {/* Reply */}
        <div className="px-6 py-4 border-t border-neutral-800 space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="rounded border-neutral-600"
              />
              Internal note (not visible to submitter)
            </label>
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isInternalNote ? "Internal note…" : "Reply to submitter…"}
            rows={3}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none ${
              isInternalNote
                ? "border-amber-700/50 bg-amber-950/20 text-amber-100 placeholder-amber-800 focus:border-amber-600"
                : "border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-600 focus:border-neutral-500"
            }`}
          />
          {replyError && <p className="text-xs text-red-400">{replyError}</p>}
          <div className="flex justify-end">
            <button
              onClick={sendReply}
              disabled={submitting || !reply.trim()}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
            >
              {submitting ? "Sending…" : isInternalNote ? "Save Note" : "Send Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Platform ticket modal ─────────────────────────────────────────────────────
function PlatformTicketModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-3xl mb-3">✓</p>
          <h3 className="text-base font-semibold text-white mb-1">Ticket submitted to Forge team</h3>
          <p className="text-sm text-neutral-400 mb-4">AI triage is running. You&apos;ll be notified when the team responds.</p>
          <button onClick={onClose} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-white">Submit Platform Ticket</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Contact the Forge platform team</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the platform issue"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Description <span className="text-red-400">*</span></label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              placeholder="Describe the platform issue in detail…"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-500">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-neutral-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition">Cancel</button>
          <button
            disabled={pending || !title.trim() || body.trim().length < 10}
            onClick={() => {
              if (!title.trim() || body.trim().length < 10) {
                setError("Title and description (min 10 chars) are required."); return;
              }
              setError(null);
              start(async () => {
                const res = await submitPlatformTicketAction(slug, { title: title.trim(), body: body.trim(), priority });
                if (res.ok) setDone(true);
                else setError(res.error ?? "Submission failed.");
              });
            }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
          >
            {pending ? "Submitting…" : "Submit to Forge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stalled threshold settings ────────────────────────────────────────────────
function StalledSetting({ slug, current }: { slug: string; current: number }) {
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
            await saveTenantStalledThresholdAction(slug, Number(val));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          });
        }}
        className="rounded-md bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600 transition disabled:opacity-40"
      >
        {saving ? "…" : saved ? "✓" : "Save"}
      </button>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SupportPage({
  tickets: initialTickets,
  slug,
  stalledDays,
}: {
  tickets: SupportTicket[];
  slug: string;
  stalledDays: number;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [tab, setTab] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  const stalled = tickets.filter((t) => isStalled(t, stalledDays));
  const filtered = tab === "all" ? tickets : tickets.filter((t) => t.status === tab);

  function handleStatusChange(id: string, status: string) {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: status as SupportTicket["status"], updated_at: new Date().toISOString() } : t));
    if (selectedTicket?.id === id) {
      setSelectedTicket((s) => s ? { ...s, status: status as SupportTicket["status"] } : s);
    }
  }

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Team Support Queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Internal support requests from your team members.
          </p>
        </div>
        <button
          onClick={() => setShowPlatformModal(true)}
          className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
        >
          Contact Forge Team ↗
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile label="Open" value={open} accent={open > 0 ? "text-blue-600" : "text-white"} />
        <StatTile label="In Progress" value={inProgress} accent={inProgress > 0 ? "text-amber-500" : "text-white"} />
        <StatTile label="Stalled" value={stalled.length} accent={stalled.length > 0 ? "text-orange-500" : "text-white"} />
        <StatTile label="Resolved" value={resolved} accent="text-green-600" />
      </div>

      {/* Avg resolution + stalled setting */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <p className="text-xs text-neutral-500">
          Avg resolution: <span className="font-medium text-neutral-300">{avgResolutionDays(tickets)}</span>
        </p>
        <StalledSetting slug={slug} current={stalledDays} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 w-fit mb-4">
        {(["all", "open", "in_progress", "resolved"] as const).map((t) => {
          const count = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}>
              {t === "all" ? "All" : STATUS_LABELS[t]}{" "}
              <span className="ml-1 text-xs text-neutral-500">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No tickets in this category.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Submitted by</th>
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
                    className="border-b border-neutral-800/60 last:border-0 cursor-pointer hover:bg-neutral-800/40 transition"
                  >
                    <td className="px-4 py-3 max-w-[240px]">
                      <div className="flex items-center gap-2">
                        {stall && (
                          <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">Stalled</span>
                        )}
                        <span className="text-neutral-100 truncate">{ticket.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400 max-w-[160px] truncate">
                      {ticket.actor_label ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-700 text-neutral-400"}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
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

      {/* Modals */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          slug={slug}
          stalledDays={stalledDays}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={handleStatusChange}
        />
      )}
      {showPlatformModal && <PlatformTicketModal slug={slug} onClose={() => setShowPlatformModal(false)} />}
    </div>
  );
}
