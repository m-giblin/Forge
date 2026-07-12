"use client";

import { useRef, useState, useTransition, useEffect, useCallback } from "react";
import { reportBugAction, attachFilesToBugAction } from "@/app/report-actions";

const MAX_FILES = 5;
const MAX_MB = 10;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

// Annotation rectangle drawn by user
type Rect = { x: number; y: number; w: number; h: number };

function AnnotateCanvas({
  dataUrl,
  onDone,
  onCancel,
}: {
  dataUrl: string;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const rectsRef = useRef<Rect[]>([]);
  const [rects, setRects] = useState<Rect[]>([]);

  // Load image onto canvas once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Scale to fit within 900×600 while preserving aspect ratio
      const maxW = 900;
      const maxH = 600;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      redraw(canvas, img, []);
    };
    img.src = dataUrl;
  }, [dataUrl]);

  function redraw(canvas: HTMLCanvasElement, img: HTMLImageElement, rs: Rect[]) {
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    for (const r of rs) {
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "rgba(239,68,68,0.08)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = getPos(e);
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !canvasRef.current || !imgRef.current) return;
    const pos = getPos(e);
    const start = drawingRef.current;
    const preview: Rect = { x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y };
    redraw(canvasRef.current, imgRef.current, [...rectsRef.current, preview]);
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !canvasRef.current || !imgRef.current) return;
    const pos = getPos(e);
    const start = drawingRef.current;
    const r: Rect = { x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y };
    if (Math.abs(r.w) > 4 || Math.abs(r.h) > 4) {
      const next = [...rectsRef.current, r];
      rectsRef.current = next;
      setRects(next);
      redraw(canvasRef.current, imgRef.current, next);
    }
    drawingRef.current = null;
  }

  function handleUndo() {
    if (!canvasRef.current || !imgRef.current) return;
    const next = rectsRef.current.slice(0, -1);
    rectsRef.current = next;
    setRects(next);
    redraw(canvasRef.current, imgRef.current, next);
  }

  function handleDone() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onDone(blob); }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80">
      <div className="flex flex-col items-center gap-3 max-w-[95vw]">
        <p className="text-white text-sm font-medium">Draw to highlight — click and drag to add a red box</p>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          className="cursor-crosshair rounded border-2 border-white/20 shadow-2xl"
          style={{ maxWidth: "90vw", maxHeight: "65vh" }}
        />
        <div className="flex gap-3">
          <button
            onClick={handleUndo}
            disabled={rects.length === 0}
            className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={handleDone}
            className="px-4 py-1.5 text-sm rounded bg-red-500 hover:bg-red-400 text-white font-medium"
          >
            Attach screenshot
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // Screenshot state
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [screenshotCapturing, setScreenshotCapturing] = useState(false);
  const [showAnnotate, setShowAnnotate] = useState(false);

  const captureScreenshot = useCallback(async () => {
    setScreenshotCapturing(true);
    try {
      // Dynamic import so it doesn't bloat initial bundle
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: window.devicePixelRatio > 1 ? 1.5 : 1,
        ignoreElements: (el) => el.id === "forge-bug-widget",
      });
      const url = canvas.toDataURL("image/png");
      setScreenshotUrl(url);
    } catch {
      // Silently fail — not every page renders perfectly
    } finally {
      setScreenshotCapturing(false);
    }
  }, []);

  function openModal() {
    setPageUrl(window.location.href);
    setDone(null);
    setError(null);

    // Capture technical environment metadata automatically
    const nav = window.navigator;
    const scr = window.screen;
    const meta = {
      url: window.location.href,
      browser: nav.userAgent,
      language: nav.language,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      screen: `${scr.width}×${scr.height}`,
      devicePixelRatio: window.devicePixelRatio,
      platform: (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform,
      online: nav.onLine,
      timestamp: new Date().toISOString(),
    };
    setEnvMeta(JSON.stringify(meta));

    // Kick off screenshot capture in background (before modal renders on top)
    setScreenshotUrl(null);
    setScreenshotBlob(null);
    captureScreenshot();
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
    setScreenshotUrl(null); setScreenshotBlob(null);
  }

  function removeScreenshot() {
    setScreenshotUrl(null);
    setScreenshotBlob(null);
  }

  function handleAnnotateDone(blob: Blob) {
    setScreenshotBlob(blob);
    const url = URL.createObjectURL(blob);
    setScreenshotUrl(url);
    setShowAnnotate(false);
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

        // Attach screenshot blob first (if any), then user files
        const allAttachments = new FormData();
        if (screenshotBlob) {
          allAttachments.append("file", new File([screenshotBlob], "screenshot.png", { type: "image/png" }));
        }
        files.forEach((f) => allAttachments.append("file", f));
        if (screenshotBlob || files.length > 0) {
          await attachFilesToBugAction(id, allAttachments);
        }

        setDone(key);
        setTitle(""); setDescription(""); setPriority("medium"); setSeverity("minor");
        setPageUrl(""); setFiles([]); setScreenshotUrl(null); setScreenshotBlob(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to report");
      }
    });
  }

  return (
    <>
      <div id="forge-bug-widget">
        <button
          onClick={openModal}
          className="fixed bottom-5 left-5 z-40 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
        >
          🐛 Report a bug
        </button>
      </div>

      {showAnnotate && screenshotUrl && (
        <AnnotateCanvas
          dataUrl={screenshotUrl}
          onDone={handleAnnotateDone}
          onCancel={() => setShowAnnotate(false)}
        />
      )}

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

                {/* Screenshot capture strip */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Screenshot</label>
                  {screenshotCapturing && (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 py-2.5 px-3 text-xs text-neutral-400">
                      <span className="animate-pulse">●</span> Capturing page…
                    </div>
                  )}
                  {!screenshotCapturing && screenshotUrl && (
                    <div className="rounded-lg border border-neutral-200 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotUrl} alt="Page screenshot" className="w-full max-h-32 object-cover object-top" />
                      <div className="flex gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setShowAnnotate(true)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          ✏️ Annotate
                        </button>
                        <span className="text-neutral-300">|</span>
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="text-xs text-neutral-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                        {screenshotBlob && (
                          <span className="ml-auto text-xs text-green-600 font-medium">Annotated ✓</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!screenshotCapturing && !screenshotUrl && (
                    <button
                      type="button"
                      onClick={captureScreenshot}
                      className="w-full rounded-lg border border-dashed border-neutral-300 py-2 text-xs text-neutral-400 hover:bg-neutral-50 transition"
                    >
                      📷 Capture screenshot
                    </button>
                  )}
                </div>

                {/* File attachments */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    Attachments <span className="font-normal text-neutral-400">(up to {MAX_FILES} files)</span>
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
                      + Add file
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
