"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import type { SupportTicket } from "@/lib/repositories/supportTickets";
import { submitTicketAction, type AttachmentInput } from "./actions";

const STATUS_STYLES: Record<SupportTicket["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-neutral-100 text-neutral-500",
};

const STATUS_LABELS: Record<SupportTicket["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<SupportTicket["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
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

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼";
  if (type === "application/pdf") return "📄";
  if (type.includes("word")) return "📝";
  if (type.includes("excel") || type.includes("spreadsheet") || type === "text/csv") return "📊";
  return "📎";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SupportPage({
  tickets,
  slug,
}: {
  tickets: SupportTicket[];
  slug: string;
}) {
  const [showForm, setShowForm] = useState(false);
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
    setTitle("");
    setBody("");
    setPriority("medium");
    setAttachments([]);
    setError(null);
    setFileError(null);
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setFileError(null);
    const arr = Array.from(files);
    const current = attachments;
    if (current.length + arr.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} files per ticket.`);
      return;
    }
    const totalBytes =
      current.reduce((s, a) => s + a.size, 0) +
      arr.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
      setFileError(`Total attachments must be under ${MAX_TOTAL_MB} MB.`);
      return;
    }
    const encoded = await Promise.all(
      arr.map(async (f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        data: await fileToBase64(f),
      }))
    );
    setAttachments((prev) => [...prev, ...encoded]);
  }, [attachments]);

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (body.trim().length < 20) { setError("Please provide more detail (at least 20 characters)."); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitTicketAction(slug, {
          title: title.trim(),
          body: body.trim(),
          priority,
          attachments,
        });
        if (result.ok) {
          setSuccess(true);
          resetForm();
          setShowForm(false);
          setTimeout(() => window.location.reload(), 800);
        } else {
          setError("Something went wrong. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="px-6 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Get Support</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Submit issues to the Forge platform team. AI triage runs automatically on every request.
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
          ✓ Request submitted. AI triage is running — you will be notified in your inbox shortly.
        </div>
      )}

      {/* Form */}
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
              placeholder="Brief summary of the issue"
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
              placeholder="Describe the issue — what happened, steps to reproduce, any error messages…"
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

          {/* Drag-and-drop attachments */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Attachments <span className="text-neutral-400 font-normal">(optional — max {MAX_FILES} files, {MAX_TOTAL_MB} MB total)</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100"
              }`}
            >
              <p className="text-sm text-neutral-500">
                Drop files here or <span className="text-indigo-600 font-medium">browse</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Images, PDF, Word, Excel, CSV — up to {MAX_TOTAL_MB} MB total
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}

            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <span className="text-base">{fileIcon(a.type)}</span>
                    <span className="flex-1 truncate text-sm text-neutral-700">{a.name}</span>
                    <span className="text-xs text-neutral-400 shrink-0">{formatBytes(a.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="text-neutral-400 hover:text-red-500 transition-colors ml-1"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      )}

      {/* Ticket history */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide">Your Requests</h2>
        {tickets.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-neutral-400">No support requests yet. Use the button above to get help.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-900 leading-snug">{ticket.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-neutral-400">{PRIORITY_LABELS[ticket.priority]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </div>

              {ticket.ai_triage_summary && (
                <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
                  <p className="text-xs font-semibold text-indigo-600 mb-1">✨ AI Triage</p>
                  <p className="text-xs text-neutral-700 leading-relaxed">{ticket.ai_triage_summary}</p>
                </div>
              )}

              {/* Attachments indicator */}
              {Array.isArray((ticket as Record<string, unknown>).attachments) &&
                ((ticket as Record<string, unknown>).attachments as unknown[]).length > 0 && (
                <p className="mt-2 text-xs text-neutral-400">
                  📎 {((ticket as Record<string, unknown>).attachments as unknown[]).length} attachment{((ticket as Record<string, unknown>).attachments as unknown[]).length !== 1 ? "s" : ""}
                </p>
              )}

              <p className="mt-2 text-xs text-neutral-400">
                Submitted {new Date(ticket.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
