"use client";

import { useState, useTransition } from "react";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { createIssueAction, draftIssueFromDescriptionAction } from "./actions";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

function defaultKey(opts: FieldOption[]): string {
  return (opts.find((o) => o.is_default) ?? opts[0])?.key ?? "";
}

export default function NewIssueForm({
  slug,
  projects,
  priorities,
  types,
  categories,
  customFields,
  sprints,
  members,
  onCreated,
}: {
  slug: string;
  projects: Project[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  sprints: Sprint[];
  members: Member[];
  onCreated: (issue: Issue) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState(defaultKey(priorities));
  const [type, setType] = useState(defaultKey(types));
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sprintId, setSprintId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiMode, setAiMode] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiPending, setAiPending] = useState(false);
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
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setAiDescription(transcript);
      setAiMode(true);
      setVoiceListening(false);
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    rec.start();
  }

  function draftWithAI() {
    if (!aiDescription.trim()) return;
    setAiPending(true);
    startTransition(async () => {
      try {
        const draft = await draftIssueFromDescriptionAction(slug, aiDescription);
        setTitle(draft.title);
        setPriority(draft.priority);
        setType(draft.type);
        setAiMode(false);
        setAiDescription("");
      } catch {
        setError("AI draft failed — try typing the title manually.");
      } finally {
        setAiPending(false);
      }
    });
  }

  const tops = categories.filter((c) => !c.parent_id);
  const catOptions = tops.flatMap((t) => [
    { id: t.id, label: t.name },
    ...categories.filter((c) => c.parent_id === t.id).map((s) => ({ id: s.id, label: `— ${s.name}` })),
  ]);

  function submit() {
    if (!title.trim() || !projectId) return;
    setError(null);
    startTransition(async () => {
      try {
        const customValues = Object.fromEntries(
          Object.entries(custom).filter(([, v]) => v !== "" && v != null)
        );
        const issue = await createIssueAction(slug, {
          projectId,
          title: title.trim(),
          priority,
          type,
          categoryId: categoryId || null,
          customValues,
          sprintId: sprintId || null,
          assigneeId: assigneeId || null,
        });
        setTitle("");
        setCustom({});
        onCreated(issue);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      {showTemplates && (
        <div className="mb-3 pb-3 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-500 mb-2">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "🐛 Bug report", title: "[Bug] ", type: "bug", priority: "high" },
              { label: "✨ Feature request", title: "[Feature] ", type: "feature", priority: "medium" },
              { label: "⚙️ Tech debt", title: "[Debt] ", type: "task", priority: "low" },
              { label: "🔒 Security issue", title: "[Security] ", type: "bug", priority: "urgent" },
              { label: "📋 Task", title: "", type: "task", priority: "medium" },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  const matchType = types.find((x) => x.key === t.type);
                  if (matchType) setType(matchType.key);
                  const matchPri = priorities.find((x) => x.key === t.priority);
                  if (matchPri) setPriority(matchPri.key);
                  setShowTemplates(false);
                }}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {aiMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-600">✨ Describe the issue in plain English</p>
            <button onClick={() => setAiMode(false)} className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
          </div>
          <textarea
            autoFocus
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder="e.g. The login button on mobile doesn't work when the keyboard is open — it gets pushed off screen and clicking elsewhere closes the keyboard..."
            rows={3}
            className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={draftWithAI}
              disabled={aiPending || !aiDescription.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiPending ? "Drafting…" : "Generate fields →"}
            </button>
            <button onClick={() => setAiMode(false)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
              Manual
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Issue title…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
          <div className="flex flex-wrap gap-2">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
              {types.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
              {priorities.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            {catOptions.length > 0 && (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                <option value="">No category</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            )}
            {members.length > 0 && (
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.label}</option>
                ))}
              </select>
            )}
            {sprints.length > 0 && (
              <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
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
            onClick={submit}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
          <button
            onClick={() => setShowTemplates((s) => !s)}
            type="button"
            title="Start from a template"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showTemplates ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
          >
            📋 Templates
          </button>
          <button
            onClick={() => { setAiMode(true); setError(null); }}
            type="button"
            title="Describe the issue in plain English and let AI fill the fields"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            ✨ AI Draft
          </button>
          <button
            onClick={startVoice}
            type="button"
            title="Dictate issue via microphone"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${voiceListening ? "border-red-300 bg-red-50 text-red-600 animate-pulse" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
          >
            {voiceListening ? "🎙 Listening…" : "🎙 Voice"}
          </button>
        </div>
      )}

      {customFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-neutral-100 pt-3">
          {customFields.map((f) => (
            <label key={f.id} className="flex flex-col gap-1 text-xs text-neutral-500">
              {f.label}
              {f.type === "select" ? (
                <select
                  value={custom[f.key] ?? ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800"
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
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800"
                />
              )}
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
