"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@/lib/repositories/supportTickets";
import { submitTicketAction } from "./actions";

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setTitle("");
    setBody("");
    setPriority("medium");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (body.trim().length < 50) {
      setError("Please provide more detail (at least 50 characters).");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitTicketAction(slug, { title: title.trim(), body: body.trim(), priority });
        if (result.ok) {
          setSuccess(true);
          resetForm();
          setShowForm(false);
          // Refresh after a moment so the new ticket appears
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          setError("Something went wrong. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <section className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Get Support</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Submit issues to the Forge platform team. AI triage happens automatically.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
            setSuccess(false);
          }}
          className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 transition-colors"
        >
          {showForm ? "Cancel" : "New Support Request"}
        </button>
      </div>

      {success && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Ticket submitted and queued for AI triage. You will see it below shortly.
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-xl border border-neutral-200 bg-white p-5 space-y-4 shadow-sm"
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
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-400"
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
              placeholder="Describe the issue in detail — what happened, steps to reproduce, any error messages. (Min 100 chars recommended)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-400 resize-none"
            />
            <p className="mt-1 text-xs text-neutral-400">
              {body.length} chars — more detail helps with faster resolution.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-400"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-neutral-400 py-8 text-center">
            No support tickets yet. Submit your first request above.
          </p>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-neutral-900 leading-snug">{ticket.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-neutral-400">{PRIORITY_LABELS[ticket.priority]}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
                  >
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </div>

              {ticket.ai_triage_summary && (
                <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
                  <p className="text-xs font-medium text-neutral-500 mb-1">AI Triage Summary</p>
                  <p className="text-xs text-neutral-700 leading-relaxed">{ticket.ai_triage_summary}</p>
                </div>
              )}

              <p className="mt-2 text-xs text-neutral-400">
                Submitted {new Date(ticket.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
