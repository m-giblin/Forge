"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  listRecurringAction,
  createRecurringAction,
  updateRecurringAction,
  deleteRecurringAction,
  type RecurringIssue,
  type RecurringProject,
} from "./recurringActions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";

const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"];
const TYPE_OPTIONS = ["task", "bug", "feature", "chore"];

function RecurringForm({
  slug,
  projects,
  onSaved,
  onCancel,
  initial,
}: {
  slug: string;
  projects: RecurringProject[];
  onSaved: () => void;
  onCancel: () => void;
  initial?: RecurringIssue;
}) {
  const [projectId, setProjectId] = useState(initial?.project_id ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "task");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? "every_sprint");
  const [interval, setInterval] = useState(String(initial?.interval_sprints ?? 2));
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!title.trim() || saving) return;
    setError(null);
    startSave(async () => {
      const data = {
        project_id: projectId,
        title: title.trim(),
        type,
        priority,
        description: description.trim() || null,
        trigger,
        interval_sprints: trigger === "every_n_sprints" ? parseInt(interval) : 1,
      };
      try {
        if (initial) await updateRecurringAction(slug, initial.id, data);
        else await createRecurringAction(slug, data);
        onSaved();
      } catch {
        setError("Save failed — check fields and try again");
      }
    });
  }

  const field = "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";

  return (
    <div className="space-y-1">
      <p className="px-0.5 text-[12.5px] font-bold text-[#20201d]">{initial ? "Edit recurring issue" : "New recurring issue"}</p>
      <FormGrid
        fields={[
          { key: "title", label: "Title", input: <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly deploy checklist" className={field} /> },
          { key: "project", label: "Project", input: (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
            </select>
          ) },
          { key: "trigger", label: "Trigger", input: (
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={field}>
              <option value="every_sprint">Every sprint</option>
              <option value="every_n_sprints">Every N sprints</option>
            </select>
          ) },
          ...(trigger === "every_n_sprints" ? [{ key: "interval", label: "N (sprints)", input: (
            <input type="number" min={2} max={12} value={interval} onChange={(e) => setInterval(e.target.value)} className={field} />
          ) }] : []),
          { key: "type", label: "Type", input: (
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) },
          { key: "priority", label: "Assignee / Priority", input: (
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field}>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) },
          { key: "description", label: "Description (optional)", input: (
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${field} resize-none`} />
          ) },
        ]}
        onCancel={onCancel}
        onSubmit={save}
        submitLabel={saving ? "Saving…" : initial ? "Save changes" : "Create template"}
      />
      {error && <p className="px-0.5 text-[11.5px] text-[#b7452f]">{error}</p>}
    </div>
  );
}

export default function RecurringPage() {
  const params = useParams();
  const slug = params.tenant as string;

  const [items, setItems] = useState<RecurringIssue[]>([]);
  const [projects, setProjects] = useState<RecurringProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringIssue | null>(null);
  const [, startToggle] = useTransition();

  async function load() {
    const { items, projects } = await listRecurringAction(slug);
    setItems(items);
    setProjects(projects);
    setLoading(false);
  }

  useEffect(() => {
    listRecurringAction(slug)
      .then(({ items, projects }) => { setItems(items); setProjects(projects); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [slug]);

  function toggleActive(item: RecurringIssue) {
    startToggle(async () => {
      await updateRecurringAction(slug, item.id, { is_active: !item.is_active });
      void load();
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this recurring issue?")) return;
    await deleteRecurringAction(slug, id);
    void load();
  }

  const projMap = new Map(projects.map((p) => [p.id, p]));

  const columns = [
    { label: "Title", flex: true },
    { label: "Project", width: 180 },
    { label: "Schedule", width: 170 },
    { label: "Status", width: 100 },
    { label: "", width: 140 },
  ];

  const tableRows: AdminTableCell[][] = items.map((item) => {
    const proj = projMap.get(item.project_id);
    const scheduleLabel = item.trigger === "every_sprint"
      ? "Every sprint"
      : `Every ${item.interval_sprints} sprints`;
    return [
      { kind: item.is_active ? "text" : "dim", value: item.title },
      { kind: "dim", value: proj?.key ?? "—" },
      { kind: "dim", value: scheduleLabel },
      {
        kind: "chip",
        value: item.is_active ? "Active" : "Paused",
        chipFg: item.is_active ? "#4b7a4f" : "#a19d90",
        chipBg: item.is_active ? "#e9f2ea" : "#f1efe9",
        onClick: () => toggleActive(item),
      },
      {
        kind: "text",
        value: (
          <span className="flex justify-end gap-3 text-[12.5px] font-semibold">
            <button type="button" onClick={() => setEditing(item)} className="text-[#b7452f] hover:underline">Edit</button>
            <button type="button" onClick={() => remove(item.id)} className="text-[#8c4632] hover:underline">Delete</button>
          </span>
        ),
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Issues"
        subtitle="Auto-created when a sprint starts"
        right={
          !showForm && !editing ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + New
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4 px-6">
        {(showForm || editing) && (
          <RecurringForm
            slug={slug}
            projects={projects}
            initial={editing ?? undefined}
            onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}

        {loading ? (
          <p className="text-[12px] text-[#a19d90]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="fw-card py-12 text-center">
            <p className="text-[12.5px] text-[#a19d90]">No recurring issues yet. Create one to auto-populate your next sprint.</p>
          </div>
        ) : (
          <AdminTable columns={columns} rows={tableRows} />
        )}
      </div>
    </div>
  );
}
