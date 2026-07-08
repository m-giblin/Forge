"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";

type RecurringIssue = {
  id: string;
  project_id: string;
  title: string;
  type: string;
  priority: string;
  description: string | null;
  trigger: string;
  interval_sprints: number;
  is_active: boolean;
};

type Project = { id: string; key: string; name: string };

const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"];
const TYPE_OPTIONS = ["task", "bug", "feature", "chore"];

function RecurringForm({
  projects,
  onSaved,
  onCancel,
  initial,
}: {
  projects: Project[];
  onSaved: () => void;
  onCancel: () => void;
  initial?: RecurringIssue;
}) {
  const params = useParams();
  const slug = params.tenant as string;
  const [projectId, setProjectId] = useState(initial?.project_id ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "task");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? "every_sprint");
  const [interval, setInterval] = useState(String(initial?.interval_sprints ?? 2));
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const KEY = process.env.NEXT_PUBLIC_FORGE_SELF_API_KEY ?? "";

  function save() {
    setError(null);
    startSave(async () => {
      const body = {
        project_id: projectId,
        title: title.trim(),
        type,
        priority,
        description: description.trim() || null,
        trigger,
        interval_sprints: trigger === "every_n_sprints" ? parseInt(interval) : 1,
      };
      const url = initial
        ? `/api/v1/recurring-issues/${initial.id}?slug=${slug}`
        : `/api/v1/recurring-issues?slug=${slug}`;
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("Save failed — check fields and try again"); return; }
      onSaved();
    });
  }

  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";
  const label = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">{initial ? "Edit" : "New"} Recurring Issue</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly deploy checklist" className={field} />
        </div>
        <div>
          <label className={label}>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Schedule</label>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={field}>
            <option value="every_sprint">Every sprint</option>
            <option value="every_n_sprints">Every N sprints</option>
          </select>
        </div>
        {trigger === "every_n_sprints" && (
          <div>
            <label className={label}>N (sprints)</label>
            <input type="number" min={2} max={12} value={interval} onChange={(e) => setInterval(e.target.value)} className={field} />
          </div>
        )}
        <div>
          <label className={label}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
            {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field}>
            {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Description <span className="text-neutral-400">(optional)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${field} resize-none`} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !title.trim()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
      </div>
    </div>
  );
}

export default function RecurringPage() {
  const params = useParams();
  const slug = params.tenant as string;
  const KEY = process.env.NEXT_PUBLIC_FORGE_SELF_API_KEY ?? "";

  const [items, setItems] = useState<RecurringIssue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringIssue | null>(null);
  const [, startToggle] = useTransition();

  async function load() {
    const [itemsRes, projectsRes] = await Promise.all([
      fetch(`/api/v1/recurring-issues?slug=${slug}`, { headers: { Authorization: `Bearer ${KEY}` } }),
      fetch(`/api/v1/projects?slug=${slug}`, { headers: { Authorization: `Bearer ${KEY}` } }),
    ]);
    if (itemsRes.ok) setItems((await itemsRes.json()).data ?? []);
    if (projectsRes.ok) setProjects((await projectsRes.json()).data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/recurring-issues?slug=${slug}`, { headers: { Authorization: `Bearer ${KEY}` } }),
      fetch(`/api/v1/projects?slug=${slug}`, { headers: { Authorization: `Bearer ${KEY}` } }),
    ])
      .then(async ([itemsRes, projectsRes]) => {
        if (itemsRes.ok) setItems((await itemsRes.json()).data ?? []);
        if (projectsRes.ok) setProjects((await projectsRes.json()).data ?? []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [slug, KEY]);

  function toggleActive(item: RecurringIssue) {
    startToggle(async () => {
      await fetch(`/api/v1/recurring-issues/${item.id}?slug=${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      void load();
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this recurring issue?")) return;
    await fetch(`/api/v1/recurring-issues/${id}?slug=${slug}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${KEY}` },
    });
    void load();
  }

  const projMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Recurring Issues</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Auto-created when a sprint starts. Useful for deploy checklists, security reviews, or any repeating work.</p>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + New
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <RecurringForm
          projects={projects}
          initial={editing ?? undefined}
          onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-400">
          No recurring issues yet. Create one to auto-populate your next sprint.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const proj = projMap.get(item.project_id);
            const scheduleLabel = item.trigger === "every_sprint"
              ? "Every sprint"
              : `Every ${item.interval_sprints} sprints`;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${item.is_active ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50 opacity-60"}`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.is_active ? "text-neutral-900" : "text-neutral-500 line-through"}`}>{item.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {proj ? `${proj.key} · ` : ""}{item.type} · {item.priority} · {scheduleLabel}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(item)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${item.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"}`}
                >
                  {item.is_active ? "Active" : "Paused"}
                </button>
                <button onClick={() => setEditing(item)} className="text-xs text-neutral-500 hover:text-neutral-700">Edit</button>
                <button onClick={() => remove(item.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
