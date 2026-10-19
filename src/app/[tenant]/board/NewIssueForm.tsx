"use client";

import { useRef, useState, useTransition } from "react";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { type IssueTemplate } from "@/lib/repositories/issueTemplates";
import { createIssueAction } from "./actions";
import { requestUploadUrlAction, confirmUploadAction } from "../issues/[id]/actions";
import { ATTACHMENT_ACCEPT, ATTACHMENT_TYPES_LABEL, MAX_ATTACHMENT_BYTES, resolveAttachmentType, storageContentType } from "@/lib/attachmentTypes";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };
type ParentOption = { id: string; number: number; title: string };

// Same scale the issue page offers.
const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

function defaultKey(opts: FieldOption[]): string {
  return (opts.find((o) => o.is_default) ?? opts[0])?.key ?? "";
}

async function uploadFile(slug: string, issueId: string, file: File): Promise<string | null> {
  const type = resolveAttachmentType(file.name, file.type);
  if (!type) return `${file.name}: file type not supported`;
  try {
    const { attachmentId, signedUrl } = await requestUploadUrlAction(slug, issueId, file.name, type, file.size);
    const res = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": storageContentType(type) }, body: file });
    if (!res.ok) return `${file.name}: upload failed (${res.status})`;
    const confirmed = await confirmUploadAction(slug, attachmentId);
    return confirmed.ok ? null : `${file.name}: ${confirmed.error}`;
  } catch (e) {
    return `${file.name}: ${e instanceof Error ? e.message : "upload failed"}`;
  }
}

export default function NewIssueForm({
  slug,
  projects,
  statuses,
  priorities,
  types,
  categories,
  customFields,
  templates,
  sprints,
  members,
  parentOptions,
  onCreated,
  onClose,
}: {
  slug: string;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  templates: IssueTemplate[];
  sprints: Sprint[];
  members: Member[];
  parentOptions: ParentOption[];
  onCreated: (issue: Issue, uploadErrors: string[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState(defaultKey(priorities));
  const [type, setType] = useState(defaultKey(types));
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sprintId, setSprintId] = useState("");
  const [showMore, setShowMore] = useState(false);
  // A new issue starts in one of the board's open columns, never a finished one.
  const openStatuses = [...statuses].filter((s) => !s.is_terminal).sort((a, b) => a.position - b.position);
  const [status, setStatus] = useState(defaultKey(openStatuses));
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [parentId, setParentId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [voiceListening, setVoiceListening] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  function startVoice() {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Voice input not supported in this browser."); return; }
    const rec = new (SpeechRecognition as new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void })();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    setVoiceListening(true);
    // Dictation goes straight into the description.
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setDescription((d) => (d.trim() ? `${d.trim()} ${transcript}` : transcript));
      setVoiceListening(false);
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    rec.start();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!resolveAttachmentType(f.name, f.type)) { setError(`${f.name}: file type not supported.`); continue; }
      if (f.size > MAX_ATTACHMENT_BYTES) { setError(`${f.name}: exceeds 10 MB limit.`); continue; }
      next.push(f);
    }
    setFiles((cur) => [...cur, ...next]);
  }

  const tops = categories.filter((c) => !c.parent_id);
  const catOptions = tops.flatMap((t) => [
    { id: t.id, label: t.name },
    ...categories.filter((c) => c.parent_id === t.id).map((s) => ({ id: s.id, label: `— ${s.name}` })),
  ]);

  function submit() {
    if (!title.trim() || !projectId || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const customValues = Object.fromEntries(
          Object.entries(custom).filter(([, v]) => v !== "" && v != null)
        );
        const issue = await createIssueAction(slug, {
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          type,
          categoryId: categoryId || null,
          customValues,
          sprintId: sprintId || null,
          assigneeId: assigneeId || null,
          status: status || undefined,
          startDate: startDate || null,
          dueDate: dueDate || null,
          storyPoints: storyPoints ? Number(storyPoints) : null,
          parentId: parentId || null,
        });
        // Files need the issue to exist first, so they upload right after.
        const uploadErrors: string[] = [];
        for (const f of files) {
          const err = await uploadFile(slug, issue.id, f);
          if (err) uploadErrors.push(err);
        }
        onCreated(issue, uploadErrors);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  }

  const select = "rounded-lg border border-neutral-300 px-2 py-2 text-sm";
  const field = "flex flex-col gap-1 text-xs text-neutral-500";
  const input = "rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">New issue</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        {showTemplates && (
          <div className="mb-3 pb-3 border-b border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 mb-2">Quick templates</p>
            {templates.length === 0 ? (
              <p className="text-xs text-neutral-400">No templates configured for this workspace yet — add some under Admin → Fields & categories.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTitle(t.title_prefix);
                      const matchType = types.find((x) => x.key === t.type);
                      if (matchType) setType(matchType.key);
                      const matchPri = priorities.find((x) => x.key === t.priority);
                      if (matchPri) setPriority(matchPri.key);
                      setShowTemplates(false);
                    }}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-[#f5e3dd] hover:border-[#e8c9bd] hover:text-[#8c4632] transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Issue title…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional) — steps to reproduce, expected vs actual, links…"
            rows={4}
            className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
          <div className="flex flex-wrap gap-2">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={select} aria-label="Project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={select} aria-label="Status">
              {openStatuses.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={select} aria-label="Type">
              {types.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={select} aria-label="Priority">
              {priorities.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            {catOptions.length > 0 && (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={select} aria-label="Category">
                <option value="">No category</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            )}
            {members.length > 0 && (
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={select} aria-label="Assignee">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.label}</option>
                ))}
              </select>
            )}
            {sprints.length > 0 && (
              <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className={select} aria-label="Sprint">
                <option value="">No sprint</option>
                {sprints.filter((s) => s.status !== "completed").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.status === "active" ? "▶ " : "○ "}{s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
            aria-expanded={showMore}
          >
            {showMore ? "▾ Fewer details" : "▸ More details"}
          </button>
          {showMore && (
            <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <label className={field}>
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
              </label>
              <label className={field}>
                Due date
                <input type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} className={input} />
              </label>
              <label className={field}>
                Story points
                <select value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} className={input}>
                  <option value="">—</option>
                  {STORY_POINTS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              {parentOptions.length > 0 && (
                <label className={field}>
                  Parent issue
                  <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={`${input} max-w-[16rem]`}>
                    <option value="">None</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>#{p.number} {p.title}</option>
                    ))}
                  </select>
                </label>
              )}
              {customFields.map((f) => (
                <label key={f.id} className={field}>
                  {f.label}
                  {f.type === "select" ? (
                    <select
                      value={custom[f.key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                      className={input}
                    >
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={custom[f.key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                      className={input}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInput.current?.click()}
            className={`cursor-pointer rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${dragOver ? "border-[#b7452f] bg-[#f5e3dd] text-[#8c4632]" : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"}`}
          >
            📎 Drop files here or click to attach ({ATTACHMENT_TYPES_LABEL} · 10 MB max)
            <input ref={fileInput} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border border-neutral-100 px-2 py-1 text-xs text-neutral-700">
                  <span className="truncate">{f.name} · {Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="ml-2 text-neutral-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>✕</button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={submit}
              disabled={pending || !title.trim()}
              className="rounded-lg border border-[#5e2c1f] px-4 py-2 text-sm font-medium text-[#f2e9d8] disabled:opacity-50"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              {pending ? (files.length ? "Creating & uploading…" : "Creating…") : "Create"}
            </button>
            <button
              onClick={() => setShowTemplates((s) => !s)}
              type="button"
              title="Start from a template"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showTemplates ? "border-[#e8c9bd] bg-[#f5e3dd] text-[#8c4632]" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
            >
              📋 Templates
            </button>
            <button
              onClick={startVoice}
              type="button"
              title="Dictate the description via microphone"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${voiceListening ? "border-red-300 bg-red-50 text-red-600 animate-pulse" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
            >
              {voiceListening ? "🎙 Listening…" : "🎙 Voice"}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
