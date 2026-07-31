"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueAttachment } from "@/lib/repositories/issueAttachments";
import type { AttachmentPin } from "@/lib/repositories/attachmentPins";
import {
  getAttachmentDownloadUrlAction, listAttachmentPinsAction, addAttachmentPinAction,
  setAttachmentPinResolvedAction, deleteAttachmentPinAction,
} from "./actions";

export default function AttachmentProofingModal({
  slug, issueId, attachment, readOnly, onClose,
}: {
  slug: string; issueId: string; attachment: IssueAttachment; readOnly: boolean; onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<AttachmentPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<{ xPct: number; yPct: number } | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAttachmentDownloadUrlAction(slug, attachment.storagePath),
      listAttachmentPinsAction(slug, attachment.id),
    ])
      .then(([url, pinList]) => { if (active) { setImageUrl(url); setPins(pinList); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attachment.storagePath, attachment.id]);

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (readOnly || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    setActivePinId(null);
    setDraftPin({ xPct, yPct });
    setDraftComment("");
  }

  async function submitDraftPin() {
    if (!draftPin || !draftComment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const pin = await addAttachmentPinAction(slug, attachment.id, issueId, draftPin.xPct, draftPin.yPct, draftComment);
      setPins((p) => [...p, pin]);
      setDraftPin(null);
      setDraftComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add pin");
    } finally {
      setSaving(false);
    }
  }

  async function toggleResolved(pin: AttachmentPin) {
    setSaving(true);
    try {
      await setAttachmentPinResolvedAction(slug, issueId, pin.id, !pin.resolved);
      setPins((p) => p.map((x) => (x.id === pin.id ? { ...x, resolved: !x.resolved } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update pin");
    } finally {
      setSaving(false);
    }
  }

  async function removePin(pin: AttachmentPin) {
    setSaving(true);
    try {
      await deleteAttachmentPinAction(slug, issueId, pin.id);
      setPins((p) => p.filter((x) => x.id !== pin.id));
      setActivePinId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete pin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image + pins */}
        <div className="relative flex-1 overflow-auto bg-neutral-900">
          {loading && <div className="flex h-96 items-center justify-center text-sm text-neutral-400">Loading…</div>}
          {imageUrl && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL; next/image's remote-pattern allowlist doesn't fit a per-request signed origin */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt={attachment.filename}
                onClick={handleImageClick}
                className={readOnly ? "" : "cursor-crosshair"}
              />
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  onClick={(e) => { e.stopPropagation(); setDraftPin(null); setActivePinId(activePinId === pin.id ? null : pin.id); }}
                  style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg transition-transform hover:scale-110 ${
                    pin.resolved ? "bg-emerald-500" : "bg-red-500"
                  }`}
                >
                  {pin.number}
                </button>
              ))}
              {draftPin && (
                <div
                  style={{ left: `${draftPin.xPct}%`, top: `${draftPin.yPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full border-2 border-white bg-indigo-500 shadow-lg"
                />
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex w-80 shrink-0 flex-col border-l border-neutral-200">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">{attachment.filename}</p>
              <p className="text-xs text-neutral-400">{pins.length} pin{pins.length === 1 ? "" : "s"}{!readOnly ? " · click the image to add one" : ""}</p>
            </div>
            <button onClick={onClose} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">✕</button>
          </div>

          {error && <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {draftPin && (
              <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50 p-3">
                <p className="mb-1.5 text-xs font-semibold text-indigo-700">New pin</p>
                <textarea
                  autoFocus
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder="What needs attention here?"
                  rows={2}
                  className="w-full rounded border border-indigo-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-400 resize-none"
                />
                <div className="mt-2 flex gap-1.5">
                  <button onClick={submitDraftPin} disabled={saving || !draftComment.trim()} className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                    Add pin
                  </button>
                  <button onClick={() => setDraftPin(null)} className="rounded-lg px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100">Cancel</button>
                </div>
              </div>
            )}

            {pins.length === 0 && !draftPin && (
              <p className="text-sm text-neutral-400">No pins yet.{!readOnly && " Click anywhere on the image to leave feedback at that spot."}</p>
            )}

            {pins.map((pin) => (
              <div
                key={pin.id}
                onClick={() => setActivePinId(activePinId === pin.id ? null : pin.id)}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  activePinId === pin.id ? "border-indigo-300 bg-indigo-50" : pin.resolved ? "border-neutral-100 bg-neutral-50 opacity-60" : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${pin.resolved ? "bg-emerald-500" : "bg-red-500"}`}>
                    {pin.number}
                  </span>
                  <p className={`flex-1 text-sm text-neutral-800 ${pin.resolved ? "line-through" : ""}`}>{pin.comment}</p>
                </div>
                {!readOnly && (
                  <div className="mt-2 flex gap-2 pl-7">
                    <button onClick={(e) => { e.stopPropagation(); toggleResolved(pin); }} disabled={saving} className="text-xs font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50">
                      {pin.resolved ? "Reopen" : "Mark resolved"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removePin(pin); }} disabled={saving} className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
