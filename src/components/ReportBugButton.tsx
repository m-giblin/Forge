"use client";

import { useState, useTransition } from "react";
import { reportBugAction } from "@/app/report-actions";

export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [severity, setSeverity] = useState("minor");
  const [pageUrl, setPageUrl] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setPageUrl(window.location.pathname);
    setDone(null);
    setError(null);
    setOpen(true);
  }

  function submit() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const desc = [
          description.trim(),
          pageUrl ? `**Page:** ${pageUrl}` : "",
          `**Severity:** ${severity}`,
        ].filter(Boolean).join("\n\n");
        const { key } = await reportBugAction({ title, description: desc, priority });
        setDone(key);
        setTitle(""); setDescription(""); setPriority("medium"); setSeverity("minor"); setPageUrl("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to report");
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
      >
        🐛 Report a bug
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Report a bug</h2>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            {done ? (
              <div className="space-y-3">
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  Filed as <span className="font-mono font-semibold">{done}</span> ✓
                </p>
                <button onClick={() => setDone(null)} className="text-sm text-neutral-600 hover:underline">Report another</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Title <span className="text-red-500">*</span></label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="What&apos;s broken?"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm"
                    >
                      <option value="critical">🔴 Critical</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Severity</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm"
                    >
                      <option value="blocker">Blocker</option>
                      <option value="major">Major</option>
                      <option value="minor">Minor</option>
                      <option value="cosmetic">Cosmetic</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Page</label>
                  <input
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder="Auto-detected from current page"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Steps / details</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, expected vs actual…"
                    rows={3}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  onClick={submit}
                  disabled={pending || !title.trim()}
                  className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {pending ? "Filing…" : "File bug"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
