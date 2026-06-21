"use client";

import { useState, useTransition } from "react";
import { updateTicketStatusAction, updatePlatformNotesAction } from "./actions";

type Ticket = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  actor_label: string | null;
  title: string;
  body: string;
  status: string;
  priority: string;
  ai_triage_summary: string | null;
  ai_guidance: string | null;
  platform_notes: string | null;
  created_at: string;
};

const STATUS_TABS = ["all", "open", "in_progress", "resolved"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-neutral-700 text-neutral-400",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-300",
  resolved: "bg-green-500/15 text-green-300",
  closed: "bg-neutral-700 text-neutral-400",
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

export default function SupportConsole({ tickets }: { tickets: Ticket[] }) {
  const [tab, setTab] = useState<StatusTab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = tab === "all" ? tickets : tickets.filter((t) => t.status === tab);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 w-fit">
        {STATUS_TABS.map((t) => {
          const count = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t === "all" ? "All" : STATUS_LABELS[t] ?? t}{" "}
              <span className="ml-1 text-xs text-neutral-500">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No support tickets yet.</p>
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
                <th className="px-4 py-2.5 font-medium">AI Triage</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <>
                  <tr
                    key={ticket.id}
                    className="border-b border-neutral-800/60 last:border-0 cursor-pointer hover:bg-neutral-800/30"
                    onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-neutral-200">{ticket.tenant_name ?? "—"}</div>
                      {ticket.tenant_slug && (
                        <div className="font-mono text-xs text-neutral-500">/{ticket.tenant_slug}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="text-neutral-100 truncate">{ticket.title}</div>
                      {ticket.actor_label && (
                        <div className="text-xs text-neutral-500 truncate">{ticket.actor_label}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority] ?? "bg-neutral-700 text-neutral-400"}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[ticket.status] ?? "bg-neutral-700 text-neutral-400"}`}
                      >
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      {ticket.ai_triage_summary ? (
                        <p className="text-xs text-neutral-400 truncate">{ticket.ai_triage_summary}</p>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {timeAgo(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {ticket.status === "open" && (
                          <button
                            onClick={() => run(() => updateTicketStatusAction(ticket.id, "in_progress"))}
                            disabled={isPending}
                            className="text-xs font-medium text-amber-400 hover:underline disabled:opacity-40"
                          >
                            Start
                          </button>
                        )}
                        {(ticket.status === "open" || ticket.status === "in_progress") && (
                          <button
                            onClick={() => run(() => updateTicketStatusAction(ticket.id, "resolved"))}
                            disabled={isPending}
                            className="text-xs font-medium text-green-400 hover:underline disabled:opacity-40"
                          >
                            Resolve
                          </button>
                        )}
                        {ticket.tenant_slug && (
                          <a
                            href={`/${ticket.tenant_slug}/board`}
                            className="text-xs font-medium text-sky-400 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === ticket.id && (
                    <tr key={`${ticket.id}-expanded`} className="border-b border-neutral-800/60 last:border-0">
                      <td colSpan={7} className="px-4 py-4 bg-neutral-950">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Request body</p>
                            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{ticket.body}</p>
                          </div>
                          <div className="space-y-3">
                            {ticket.ai_guidance && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">AI Guidance</p>
                                <p className="text-xs text-neutral-400 whitespace-pre-wrap">{ticket.ai_guidance}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Platform Notes (internal)</p>
                              {editingNotes === ticket.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={notesValue}
                                    onChange={(e) => setNotesValue(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-neutral-500 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        run(() => updatePlatformNotesAction(ticket.id, notesValue));
                                        setEditingNotes(null);
                                      }}
                                      className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-neutral-900"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingNotes(null)}
                                      className="text-xs text-neutral-500 hover:text-neutral-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <p className="flex-1 text-xs text-neutral-400">
                                    {ticket.platform_notes || <span className="text-neutral-600">None</span>}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setEditingNotes(ticket.id);
                                      setNotesValue(ticket.platform_notes ?? "");
                                    }}
                                    className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
