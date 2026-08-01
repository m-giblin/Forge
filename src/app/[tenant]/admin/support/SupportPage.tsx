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
import { timeAgo } from "@/lib/formatRelativeTime";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

const PRIORITY_CHIP: Record<string, { fg: string; bg: string }> = {
  urgent: { fg: "#8c4632", bg: "#f7e2dc" },
  high: { fg: "#8c4632", bg: "#f7e2dc" },
  medium: { fg: "#3d5a73", bg: "#e1e9f0" },
  low: { fg: "#726e60", bg: "#f1efe9" },
};

const STATUS_CHIP: Record<string, { fg: string; bg: string }> = {
  open: { fg: "#3d5a73", bg: "#e1e9f0" },
  in_progress: { fg: "#8c4632", bg: "#f7e2dc" },
  resolved: { fg: "#3f6b45", bg: "#dfeee1" },
  closed: { fg: "#726e60", bg: "#f1efe9" },
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-[#eaf1f8] text-[#3a6ea8]",
  in_progress: "bg-[#fdf1de] text-[#c9791d]",
  resolved: "bg-[#e9f3ea] text-[#3f7d4c]",
  closed: "bg-neutral-100 text-neutral-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#fbeae8] text-[#c0392b]",
  urgent: "bg-[#f7d3cd] text-[#8c1f13] font-semibold",
  medium: "bg-[#fdf1de] text-[#c9791d]",
  low: "bg-neutral-100 text-neutral-500",
};

function isStalled(ticket: SupportTicket, stalledDays: number): boolean {
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return (Date.now() - new Date(ticket.updated_at).getTime()) / 86400000 >= stalledDays;
}

function avgResolutionDays(tickets: SupportTicket[]): string {
  const resolved = tickets.filter((t) => t.resolved_at);
  if (!resolved.length) return "—";
  const avg = resolved.reduce((sum, t) => {
    return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 86400000;
  }, 0) / resolved.length;
  return avg < 1 ? `${Math.round(avg * 24)}h` : `${avg.toFixed(1)}d`;
}

// ── Stalled threshold setting ─────────────────────────────────────────────────
function StalledSetting({ slug, current }: { slug: string; current: number }) {
  const [val, setVal] = useState(String(current));
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span>Stalled after</span>
      <input
        type="number" min="1" max="30" value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-14 rounded border border-neutral-300 bg-white px-2 py-1 text-center text-neutral-800 text-xs outline-none focus:border-neutral-500"
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
        className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200 border border-neutral-300 transition disabled:opacity-40"
      >
        {saving ? "…" : saved ? "✓" : "Save"}
      </button>
    </div>
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white border border-neutral-200 rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                {STATUS_LABELS[ticket.status]}
              </span>
              {stalled && (
                <span className="rounded-full bg-[#fdf1de] px-2 py-0.5 text-xs font-semibold text-[#c9791d]">
                  ⚠ Stalled
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-100 text-neutral-500"}`}>
                {ticket.priority}
              </span>
            </div>
            <h2 className="text-base font-semibold text-neutral-900 leading-snug">{ticket.title}</h2>
            <p className="text-xs text-neutral-500 mt-1">
              {ticket.actor_label ?? "Unknown"} · {timeAgo(ticket.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Original request */}
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
            <p className="text-xs font-medium text-neutral-500 mb-2">Request</p>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500">Move to:</span>
            {NEXT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={statusPending}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50 transition disabled:opacity-40"
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Thread */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-3">Thread</p>
            {loading ? (
              <p className="text-sm text-neutral-400 text-center py-4">Loading…</p>
            ) : comments?.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">No replies yet.</p>
            ) : (
              <div className="space-y-3">
                {comments?.map((c) => (
                  <div key={c.id} className={`rounded-xl px-4 py-3 text-sm border ${
                    c.is_internal
                      ? "bg-[#fdf1de] border-[#f3ddb4]"
                      : "bg-white border-neutral-200"
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-neutral-600">{c.author_label ?? "Unknown"}</span>
                      <div className="flex items-center gap-2">
                        {c.is_internal && (
                          <span className="rounded-full bg-[#fbe4bb] px-1.5 py-0.5 text-[10px] font-medium text-[#8a5a12]">internal note</span>
                        )}
                        <span className="text-xs text-neutral-400">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-neutral-800 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reply */}
        <div className="px-6 py-4 border-t border-neutral-200 space-y-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Internal note (not visible to submitter)
          </label>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isInternalNote ? "Internal note…" : "Reply to submitter…"}
            rows={3}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none ${
              isInternalNote
                ? "border-[#e8c07a] bg-[#fdf1de] text-neutral-800 placeholder-[#d7a860] focus:border-[#c9791d]"
                : "border-neutral-300 bg-white text-neutral-800 placeholder-neutral-400 focus:border-neutral-500"
            }`}
          />
          {replyError && <p className="text-xs text-red-600">{replyError}</p>}
          <div className="flex justify-end">
            <button
              onClick={sendReply}
              disabled={submitting || !reply.trim()}
              className="rounded-lg bg-[#b7452f] hover:bg-[#8c4632] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
        <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-3xl mb-3">✓</p>
          <h3 className="text-base font-semibold text-neutral-900 mb-1">Ticket submitted to Forge team</h3>
          <p className="text-sm text-neutral-500 mb-4">AI triage is running. You&apos;ll be notified when the team responds.</p>
          <button onClick={onClose} className="rounded-lg bg-neutral-100 border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200 transition">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Submit Platform Ticket</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Contact the Forge platform team</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl">✕</button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the platform issue"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              placeholder="Describe the platform issue in detail…"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition">Cancel</button>
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
            className="rounded-lg bg-[#b7452f] hover:bg-[#8c4632] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
          >
            {pending ? "Submitting…" : "Submit to Forge"}
          </button>
        </div>
      </div>
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

  const oldestOpen = tickets
    .filter((t) => t.status === "open")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

  const rows: AdminTableCell[][] = filtered.map((ticket) => {
    const stall = isStalled(ticket, stalledDays);
    const prio = PRIORITY_CHIP[ticket.priority] ?? PRIORITY_CHIP.low;
    const stat = STATUS_CHIP[ticket.status] ?? STATUS_CHIP.closed;
    return [
      {
        kind: "link",
        value: stall ? `⚠ ${ticket.title}` : ticket.title,
        onClick: () => setSelectedTicket(ticket),
      },
      { kind: "dim", value: ticket.actor_label ?? "—" },
      { kind: "chip", value: ticket.priority, chipFg: prio.fg, chipBg: prio.bg },
      { kind: "chip", value: STATUS_LABELS[ticket.status], chipFg: stat.fg, chipBg: stat.bg },
      { kind: "dim", value: timeAgo(ticket.updated_at) },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Queue"
        subtitle="Tickets raised by your own team"
        right={
          <button
            onClick={() => setShowPlatformModal(true)}
            className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db] transition"
          >
            Contact Forge Team ↗
          </button>
        }
      />

      <div className="space-y-6 px-6">
        {/* Stats */}
        <StatsRow
          items={[
            { label: "Open", value: open, hint: open > 0 ? "awaiting triage" : "none open", color: open > 0 ? "#b7452f" : undefined },
            { label: "In Progress", value: inProgress, hint: "being worked" },
            { label: "Resolved", value: resolved, hint: "closed out", color: "#3f6b45" },
            {
              label: "Oldest Open",
              value: oldestOpen ? timeAgo(oldestOpen.created_at) : "—",
              hint: oldestOpen ? "since submitted" : "no open tickets",
              color: oldestOpen ? "#b7452f" : undefined,
            },
          ]}
        />

        {/* Avg resolution + stalled threshold */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11.5px] text-[#726e60]">
            Avg resolution: <span className="font-semibold text-[#4a473e]">{avgResolutionDays(tickets)}</span>
          </p>
          <StalledSetting slug={slug} current={stalledDays} />
        </div>

        {/* Tabs */}
        <div className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl border border-[#ddd8c9] bg-white p-1 w-fit shadow-sm">
          {(["all", "open", "in_progress", "resolved"] as const).map((t) => {
            const count = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                  tab === t ? "bg-[#b7452f] text-white" : "text-[#726e60] hover:text-[#20201d]"
                }`}>
                {t === "all" ? "All" : STATUS_LABELS[t]}{" "}
                <span className={`ml-1 text-[11px] ${tab === t ? "text-white/70" : "text-[#a19d90]"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Ticket table */}
        {filtered.length === 0 ? (
          <div className="fw-card px-6 py-12 text-center">
            <p className="text-[12.5px] text-[#a19d90]">No tickets in this category.</p>
          </div>
        ) : (
          <AdminTable
            columns={[
              { label: "Title", flex: true },
              { label: "Submitted by", width: 160 },
              { label: "Priority", width: 90 },
              { label: "Status", width: 110 },
              { label: "Updated", width: 100 },
            ]}
            rows={rows}
          />
        )}
      </div>

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
      {showPlatformModal && (
        <PlatformTicketModal slug={slug} onClose={() => setShowPlatformModal(false)} />
      )}
    </div>
  );
}
