"use client";

import { useRef, useState, useTransition } from "react";
import { reportBugAction, attachFilesToBugAction } from "@/app/report-actions";

const MAX_FILES = 5;
const MAX_MB = 10;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

export default function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [severity, setSeverity] = useState("minor");
  const [pageUrl, setPageUrl] = useState("");
  const [envMeta, setEnvMeta] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setPageUrl(window.location.href);
    setDone(null);
    setError(null);

    // Capture technical environment metadata automatically
    const nav = window.navigator;
    const screen = window.screen;
    const meta = {
      url: window.location.href,
      browser: nav.userAgent,
      language: nav.language,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      screen: `${screen.width}×${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      platform: (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform,
      online: nav.onLine,
      timestamp: new Date().toISOString(),
    };
    setEnvMeta(JSON.stringify(meta));
    setOpen(true);
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) { setError(`Max ${MAX_FILES} files`); break; }
      if (f.size > MAX_MB * 1024 * 1024) { setError(`${f.name} exceeds ${MAX_MB} MB`); continue; }
      if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  function reset() {
    setTitle(""); setDescription(""); setPriority("medium"); setSeverity("minor");
    setPageUrl(""); setFiles([]); setDone(null); setError(null);
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

        const { id, key } = await reportBugAction({ title, description: desc, priority, environment: envMeta || undefined });

        if (files.length > 0) {
          const fd = new FormData();
          files.forEach((f) => fd.append("file", f));
          await attachFilesToBugAction(id, fd);
        }

        setDone(key);
        setTitle(""); setDescription(""); setPriority("medium"); setSeverity("minor");
        setPageUrl(""); setFiles([]);
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
                <button onClick={reset} className="text-sm text-neutral-600 hover:underline">Report another</button>
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
                    placeholder="What's broken?"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                      <option value="critical">🔴 Critical</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Severity</label>
                    <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm">
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

                {/* Attachments */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    Attachments <span className="font-normal text-neutral-400">(screenshots, up to {MAX_FILES} files)</span>
                  </label>

                  <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
                    onChange={(e) => addFiles(e.target.files)} />

                  {files.length > 0 && (
                    <ul className="mb-1.5 space-y-1">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                          <span className="flex-1 truncate">{f.name}</span>
                          <span className="shrink-0 text-neutral-400">{(f.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            className="shrink-0 font-bold text-neutral-300 hover:text-red-500">×</button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {files.length < MAX_FILES && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full rounded-lg border border-dashed border-neutral-300 py-2 text-xs text-neutral-400 hover:bg-neutral-50 transition">
                      + Add screenshot or file
                    </button>
                  )}
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
