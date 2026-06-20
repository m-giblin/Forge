"use client";

import { useRef, useState } from "react";
import type { IssueAttachment } from "@/lib/repositories/issueAttachments";
import {
  requestUploadUrlAction,
  getAttachmentDownloadUrlAction,
  deleteAttachmentAction,
} from "./actions";

const ALLOWED = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
];

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType === "application/pdf") return "📄";
  if (contentType.includes("word")) return "📝";
  if (contentType.includes("excel") || contentType.includes("spreadsheet")) return "📊";
  return "📎";
}

type UploadingFile = { name: string; progress: number; error: string | null };

export default function IssueAttachments({
  slug,
  issueId,
  initialAttachments,
  readOnly,
}: {
  slug: string;
  issueId: string;
  initialAttachments: IssueAttachment[];
  readOnly: boolean;
}) {
  const [attachments, setAttachments] = useState<IssueAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      if (!ALLOWED.includes(file.type)) {
        setUploading((u) => [...u, { name: file.name, progress: 0, error: "File type not supported." }]);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploading((u) => [...u, { name: file.name, progress: 0, error: "Exceeds 10 MB limit." }]);
        continue;
      }

      const entry: UploadingFile = { name: file.name, progress: 0, error: null };
      setUploading((u) => [...u, entry]);

      try {
        const { attachmentId, signedUrl } = await requestUploadUrlAction(
          slug, issueId, file.name, file.type, file.size
        );

        // Upload directly to Supabase Storage via signed URL.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signedUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploading((u) => u.map((x) => x.name === file.name ? { ...x, progress: pct } : x));
            }
          };
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(file);
        });

        // Add to list — the DB row was pre-inserted by the server action.
        const newAttachment: IssueAttachment = {
          id: attachmentId,
          issueId,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          storagePath: `${slug}/${issueId}/${attachmentId}-${file.name}`,
          uploadedBy: null,
          createdAt: new Date().toISOString(),
        };
        setAttachments((a) => [...a, newAttachment]);
        setUploading((u) => u.filter((x) => x.name !== file.name));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setUploading((u) => u.map((x) => x.name === file.name ? { ...x, error: msg } : x));
      }
    }
  }

  async function download(attachment: IssueAttachment) {
    try {
      const url = await getAttachmentDownloadUrlAction(slug, attachment.storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.click();
    } catch {
      alert("Could not download file.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this attachment?")) return;
    try {
      await deleteAttachmentAction(slug, id);
      setAttachments((a) => a.filter((x) => x.id !== id));
    } catch {
      alert("Could not delete attachment.");
    }
  }

  const hasContent = attachments.length > 0 || uploading.length > 0;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Attachments
        {attachments.length > 0 && (
          <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 normal-case font-normal text-neutral-600">
            {attachments.length}
          </span>
        )}
      </p>

      {/* File list */}
      {hasContent && (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 hover:border-neutral-300 transition"
            >
              <span className="text-lg shrink-0">{fileIcon(a.contentType)}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800">{a.filename}</p>
                <p className="text-xs text-neutral-400">{formatBytes(a.sizeBytes)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => download(a)}
                  title="Download"
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  ↓
                </button>
                {!readOnly && (
                  <button
                    onClick={() => remove(a.id)}
                    title="Remove"
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* In-progress uploads */}
          {uploading.map((u) => (
            <div key={u.name} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-lg shrink-0">📎</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-800">{u.name}</p>
                  {u.error ? (
                    <p className="text-xs text-red-600">{u.error}</p>
                  ) : (
                    <div className="mt-1 h-1 w-full rounded-full bg-neutral-100">
                      <div
                        className="h-1 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {u.error && (
                  <button
                    onClick={() => setUploading((up) => up.filter((x) => x.name !== u.name))}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {!readOnly && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-4 transition ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            <span className="text-xl">📎</span>
            <p className="text-xs text-neutral-500">
              Drop files here or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-[11px] text-neutral-400">PNG, JPG, GIF, PDF, Word, Excel · Max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED.join(",")}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </>
      )}
    </div>
  );
}
