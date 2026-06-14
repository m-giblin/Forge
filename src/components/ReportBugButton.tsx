"use client";

import { useState, useTransition } from "react";
import { reportBugAction } from "@/app/report-actions";

/**
 * Floating "Report a bug" button (dogfood). Files via the real /api/v1/issues
 * path. Only mounted when FORGE_SELF_API_KEY is configured.
 */
export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const { key } = await reportBugAction({ title, description });
        setDone(key);
        setTitle("");
        setDescription("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to report");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(null); setError(null); }}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
      >
        🐛 Report a bug
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Report a bug (via the API)</h2>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            {done ? (
              <div className="space-y-3">
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  Filed as <span className="font-mono font-semibold">{done}</span> via <code>/api/v1/issues</code> 🎉
                </p>
                <button onClick={() => setDone(null)} className="text-sm text-neutral-600 hover:underline">Report another</button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's broken?"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Steps, expected, actual… (optional)"
                  rows={4}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                />
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
