"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import type { SupportTicket } from "@/lib/repositories/supportTickets";
import type { TicketComment } from "@/lib/repositories/ticketComments";
import {
  submitInternalTicketAction,
  addSubmitterCommentAction,
  loadTicketCommentsAction,
  type AttachmentInput,
} from "./actions";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  resolved: "bg-green-500/15 text-green-400",
  closed: "bg-neutral-700 text-neutral-400",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_FILES = 5;
const MAX_TOTAL_MB = 15;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Thread modal ──────────────────────────────────────────────────────────────
function ThreadModal({
  ticket,
  slug,
  onClose,
}: {
  ticket: SupportTicket;
  slug: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [replyError, setReplyError] = useState<string | null>(null);

  async function loadComments() {
    setLoading(true);
    try {
      const data = await loadTicketCommentsAction(slug, ticket.id);
      setComments(data);
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  if (comments === null && !loading) loadComments();

  function sendReply() {
    if (!reply.trim()) return;
    setReplyError(null);
    startSubmit(async () => {
      const res = await addSubmitterCommentAction(slug, ticket.id, reply.trim());
      if (res.ok) {
        setReply("");
        await loadComments();
      } else {
        setReplyError(res.error ?? "Failed to send reply.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-neutral-900 leading-snug">{ticket.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                {STATUS_LABELS[ticket.status]}
              </span>
              <span className="text-xs text-neutral-400">{PRIORITY_LABELS[ticket.priority]}</span>
              <span className="text-xs text-neutral-400">· {timeAgo(ticket.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Original request */}
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
            <p className="text-xs font-medium text-neutral-500 mb-2">Your request</p>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
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
                  <div key={c.id} className={`flex gap-3 ${c.author_id ? "" : "flex-row-reverse"}`}>
                    <div className={`flex-1 rounded-xl px-4 py-3 text-sm ${
                      c.author_id ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-neutral-200"
                    }`}>
                      <p className="text-xs font-medium mb-1 text-neutral-500">{c.author_label ?? "Support"}</p>
                      <p className="text-neutral-800 whitespace-pre-wrap">{c.body}</p>
                    </div>
                    <p className="text-xs text-neutral-400 shrink-0 mt-2">{timeAgo(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reply box — only if not resolved/closed */}
        {ticket.status !== "resolved" && ticket.status !== "closed" && (
          <div className="px-6 py-4 border-t border-neutral-200">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add a reply…"
              rows={3}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
            />
            {replyError && <p className="text-xs text-red-600 mt-1">{replyError}</p>}
            <div className="flex justify-end mt-2">
              <button
                onClick={sendReply}
                disabled={submitting || !reply.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 transition disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SupportPage({
  tickets,
  slug,
}: {
  tickets: SupportTicket[];
  slug: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("medium");
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle(""); setBody(""); setPriority("medium");
    setAttachments([]); setError(null); setFileError(null);
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setFileError(null);
    const arr = Array.from(files);
    if (attachments.length + arr.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} files per ticket.`); return;
    }
    const totalBytes = attachments.reduce((s, a) => s + a.size, 0) + arr.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
      setFileError(`Total attachments must be under ${MAX_TOTAL_MB} MB.`); return;
    }
    const encoded = await Promise.all(arr.map(async (f) => ({
      name: f.name, type: f.type, size: f.size, data: await fileToBase64(f),
    })));
    setAttachments((prev) => [...prev, ...encoded]);
  }, [attachments]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (body.trim().length < 20) { setError("Please provide more detail (at least 20 characters)."); return; }
    setError(null);
    startTransition(async () => {
      const result = await submitInternalTicketAction(slug, {
        title: title.trim(), body: body.trim(), priority, attachments,
      });
      if (result.ok) {
        setSuccess(true); resetForm(); setShowForm(false);
        setTimeout(() => window.location.reload(), 800);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="px-6 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Team Support</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Submit requests to your team admin. Click any ticket to view the reply thread.
            {openCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {openCount} open
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(null); setSuccess(false); }}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {success && (
        <div className="mb-5 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ✓ Request submitted. Your team admin has been notified.
        </div>
      )}

      {/* Submission form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of what you need help with"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Describe what you need help with in as much detail as possible…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 resize-none"
            />
            <p className="mt-1 text-xs text-neutral-400">{body.length} chars</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Attachments <span className="text-neutral-400 font-normal">(optional — max {MAX_FILES} files, {MAX_TOTAL_MB} MB total)</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragOver ? "border-indigo-400 bg-indigo-50" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
              }`}
            >
              <p className="text-sm text-neutral-500">Drop files here or <span className="text-indigo-600 font-medium">browse</span></p>
              <input ref={fileInputRef} type="file" multiple accept={ACCEPT} className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <span className="flex-1 truncate text-sm text-neutral-700">{a.name}</span>
                    <span className="text-xs text-neutral-400">{formatBytes(a.size)}</span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      className="text-neutral-400 hover:text-red-500 transition ml-1">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={isPending}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700 transition disabled:opacity-50">
              {isPending ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      )}

      {/* Ticket list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide">Your Requests</h2>
        {tickets.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-neutral-400">No support requests yet. Use the button above to get help from your team admin.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="w-full text-left rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-900 leading-snug group-hover:text-indigo-700 transition-colors">
                  {ticket.title}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-neutral-400">{PRIORITY_LABELS[ticket.priority]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <p className="text-xs text-neutral-400">
                  {new Date(ticket.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
                <span className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View thread →
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Thread modal */}
      {selectedTicket && (
        <ThreadModal
          ticket={selectedTicket}
          slug={slug}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
