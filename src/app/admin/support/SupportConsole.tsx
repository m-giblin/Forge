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
import { timeAgo } from "@/lib/formatRelativeTime";

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

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  open:        { background: "#eff6ff", color: "#2563eb" },
  in_progress: { background: "#fffbeb", color: "#d97706" },
  resolved:    { background: "#f0fdf4", color: "#16a34a" },
  closed:      { background: "#f1f5f9", color: "#64748b" },
};

const PRIORITY_BADGE: Record<string, React.CSSProperties> = {
  urgent: { background: "#fef2f2", color: "#dc2626", fontWeight: 700 },
  high:   { background: "#fff7ed", color: "#ea580c" },
  medium: { background: "#fffbeb", color: "#d97706" },
  low:    { background: "#f1f5f9", color: "#64748b" },
};


function isStalled(ticket: Ticket, stalledDays: number): boolean {
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return (Date.now() - new Date(ticket.updated_at).getTime()) / 86400000 >= stalledDays;
}

function avgResolutionDays(tickets: Ticket[]): string {
  const resolved = tickets.filter((t) => t.resolved_at);
  if (!resolved.length) return "—";
  const avg = resolved.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 86400000, 0) / resolved.length;
  return avg < 1 ? `${Math.round(avg * 24)}h` : `${avg.toFixed(1)}d`;
}

function StatTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}

function StalledSetting({ current }: { current: number }) {
  const [val, setVal] = useState(String(current));
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280" }}>
      <span>Stalled after</span>
      <input type="number" min="1" max="30" value={val} onChange={(e) => setVal(e.target.value)}
        style={{ width: 52, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", textAlign: "center", fontSize: 12, color: "#111827", outline: "none" }} />
      <span>days</span>
      <button disabled={saving || !val || Number(val) < 1}
        onClick={() => start(async () => { await savePlatformStalledThresholdAction(Number(val)); setSaved(true); setTimeout(() => setSaved(false), 2000); })}
        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving || !val ? .4 : 1 }}>
        {saving ? "…" : saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}

function TicketModal({ ticket, stalledDays, onClose, onUpdate }: { ticket: Ticket; stalledDays: number; onClose: () => void; onUpdate: (id: string, patch: Partial<Ticket>) => void }) {
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
    try { setComments(await loadPlatformTicketCommentsAction(ticket.id)); } finally { setLoading(false); }
  }
  if (comments === null && !loading) loadComments();

  function sendReply() {
    if (!reply.trim()) return;
    setReplyError(null);
    startReply(async () => {
      const res = await addPlatformCommentAction(ticket.id, reply.trim(), isInternal);
      if (res.ok) { setReply(""); await loadComments(); } else { setReplyError(res.error ?? "Failed."); }
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
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 720, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, fontWeight: 600, ...(STATUS_BADGE[ticket.status] ?? { background: "#f1f5f9", color: "#64748b" }) }}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
              {stalled && <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, fontWeight: 700, background: "#fff7ed", color: "#ea580c" }}>⚠ Stalled</span>}
              <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, ...(PRIORITY_BADGE[ticket.priority] ?? { background: "#f1f5f9", color: "#64748b" }) }}>{ticket.priority}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{ticket.title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              {ticket.tenant_name ?? "—"}{ticket.tenant_slug && <span style={{ fontFamily: "monospace" }}> /{ticket.tenant_slug}</span>} · {ticket.actor_label ?? "Unknown"} · {timeAgo(ticket.created_at)}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Request body */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Request</div>
            <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ticket.body}</div>
          </div>

          {/* Status actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Move to:</span>
            {NEXT_STATUSES.map((s) => (
              <button key={s} onClick={() => changeStatus(s)} disabled={statusPending}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: statusPending ? .4 : 1 }}>
                {STATUS_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          {/* AI triage */}
          {(ticket.ai_triage_summary || ticket.ai_guidance) && (
            <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 9, padding: "12px 14px" }}>
              {ticket.ai_triage_summary && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", marginBottom: 4 }}>✨ AI Triage</div>
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{ticket.ai_triage_summary}</div>
                </div>
              )}
              {ticket.ai_guidance && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", marginBottom: 4 }}>Suggested guidance</div>
                  <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{ticket.ai_guidance}</div>
                </div>
              )}
            </div>
          )}

          {/* Thread */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Thread</div>
            {loading ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "16px 0" }}>Loading…</div>
            ) : !comments?.length ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "16px 0" }}>No replies yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {comments.map((c) => (
                  <div key={c.id} style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid", ...(c.is_internal ? { background: "#fffbeb", borderColor: "#fde68a" } : { background: "#f8fafc", borderColor: "#e5e7eb" }) }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{c.author_label ?? "Unknown"}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {c.is_internal && <span style={{ padding: "1px 6px", borderRadius: 9, background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 700 }}>internal</span>}
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{c.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform notes */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Platform Notes (internal)</div>
              {!editingNotes && <button onClick={() => setEditingNotes(true)} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Edit</button>}
            </div>
            {editingNotes ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveNotes} disabled={notesPending} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: notesPending ? .4 : 1 }}>{notesPending ? "…" : "Save"}</button>
                  <button onClick={() => { setEditingNotes(false); setNotes(ticket.platform_notes ?? ""); }} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: ticket.platform_notes ? "#374151" : "#94a3b8" }}>{ticket.platform_notes || "None"}</div>
            )}
          </div>
        </div>

        {/* Reply */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
            <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
            Internal note (not visible to submitter)
          </label>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={isInternal ? "Internal note…" : "Reply to submitter…"} rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${isInternal ? "#fde68a" : "#e5e7eb"}`, background: isInternal ? "#fffbeb" : "#fff", fontSize: 13, color: "#374151", outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          {replyError && <div style={{ fontSize: 12, color: "#dc2626" }}>{replyError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={sendReply} disabled={replyPending || !reply.trim()}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: replyPending || !reply.trim() ? .4 : 1 }}>
              {replyPending ? "Sending…" : isInternal ? "Save Note" : "Send Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupportConsole({ tickets: initialTickets, stalledDays }: { tickets: Ticket[]; stalledDays: number }) {
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

  const byTenant = Array.from(
    tickets.reduce((m, t) => { const key = t.tenant_name ?? t.tenant_id; m.set(key, (m.get(key) ?? 0) + 1); return m; }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        <StatTile label="Open" value={open} color={open > 0 ? "#2563eb" : undefined} />
        <StatTile label="In Progress" value={inProgress} color={inProgress > 0 ? "#d97706" : undefined} />
        <StatTile label="Stalled" value={stalled.length} color={stalled.length > 0 ? "#ea580c" : undefined} />
        <StatTile label="Resolved" value={resolved} color="#16a34a" />
        <StatTile label="Avg Resolution" value={avgResolutionDays(tickets)} />
      </div>

      {/* Settings + tenant breakdown */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <StalledSetting current={stalledDays} />
        {byTenant.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#94a3b8" }}>
            <span>Top tenants:</span>
            {byTenant.map(([name, count]) => (
              <span key={name} style={{ color: "#374151" }}>{name} <span style={{ color: "#94a3b8" }}>({count})</span></span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 9, padding: 4, width: "fit-content" }}>
        {STATUS_TABS.map((t) => {
          const count = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: active ? "#fff" : "transparent", color: active ? "#111827" : "#6b7280", fontWeight: active ? 600 : 400, fontSize: 12, cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
              {t === "all" ? "All" : STATUS_LABELS[t] ?? t} <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "48px 24px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          No tickets in this category.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                {["Tenant", "Title", "Priority", "Status", "Updated"].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => {
                const stall = isStalled(ticket, stalledDays);
                return (
                  <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ color: "#111827", fontWeight: 500 }}>{ticket.tenant_name ?? "—"}</div>
                      {ticket.tenant_slug && <div style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>/{ticket.tenant_slug}</div>}
                    </td>
                    <td style={{ padding: "11px 14px", maxWidth: 240 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {stall && <span style={{ padding: "1px 7px", borderRadius: 9, background: "#fff7ed", color: "#ea580c", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Stalled</span>}
                        <span style={{ color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.title}</span>
                      </div>
                      {ticket.actor_label && <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{ticket.actor_label}</div>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, fontWeight: 500, ...(PRIORITY_BADGE[ticket.priority] ?? { background: "#f1f5f9", color: "#64748b" }) }}>{ticket.priority}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, fontWeight: 500, ...(STATUS_BADGE[ticket.status] ?? { background: "#f1f5f9", color: "#64748b" }) }}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{timeAgo(ticket.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} stalledDays={stalledDays} onClose={() => setSelectedTicket(null)} onUpdate={handleUpdate} />
      )}
    </div>
  );
}
