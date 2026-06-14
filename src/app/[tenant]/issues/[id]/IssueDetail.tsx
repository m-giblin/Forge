"use client";

import { useMemo, useState, useTransition } from "react";
import { type Issue } from "@/lib/repositories/issues";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { type IssueComment, type IssueEvent } from "@/lib/repositories/issueActivity";
import { isUnassignedOverdue, unassignedThresholdMs } from "@/lib/sla";
import { updateIssueAction, deleteIssueAction, addCommentAction } from "./actions";

type Member = { userId: string; label: string };

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function ageSince(iso: string): string {
  return durMin(Date.now() - new Date(iso).getTime());
}

function durMin(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function IssueDetail({
  slug,
  issue,
  issueKey,
  statuses,
  priorities,
  types,
  categories,
  customFields,
  members,
  comments: initialComments,
  events,
  readOnly,
  canDelete,
}: {
  slug: string;
  issue: Issue;
  issueKey: string;
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  members: Member[];
  comments: IssueComment[];
  events: IssueEvent[];
  readOnly: boolean;
  canDelete: boolean;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [status, setStatus] = useState(issue.status);
  const [priority, setPriority] = useState(issue.priority);
  const [type, setType] = useState(issue.type);
  const [categoryId, setCategoryId] = useState(issue.category_id ?? "");
  const [assigneeId, setAssigneeId] = useState(issue.assignee_id ?? "");
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    Object.fromEntries(customFields.map((f) => [f.key, String((issue.custom_values ?? {})[f.key] ?? "")]))
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [comments, setComments] = useState<IssueComment[]>(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, startComment] = useTransition();

  const orderedStatuses = [...statuses].sort((a, b) => a.position - b.position);
  const tops = categories.filter((c) => !c.parent_id);
  const catOptions = tops.flatMap((t) => [
    { id: t.id, label: t.name },
    ...categories.filter((c) => c.parent_id === t.id).map((s) => ({ id: s.id, label: `— ${s.name}` })),
  ]);

  // Label maps for the timeline (events store raw keys/ids).
  const labelFor = useMemo(() => {
    const m = new Map<string, string>();
    [...statuses, ...priorities, ...types].forEach((o) => m.set(`opt:${o.key}`, o.label));
    categories.forEach((c) => m.set(`cat:${c.id}`, c.name));
    members.forEach((u) => m.set(`usr:${u.userId}`, u.label));
    return m;
  }, [statuses, priorities, types, categories, members]);

  function eventValue(field: string, raw: string | null): string {
    if (raw == null) return field === "assignee" ? "Unassigned" : "none";
    if (field === "assignee") return labelFor.get(`usr:${raw}`) ?? "someone";
    if (field === "category") return labelFor.get(`cat:${raw}`) ?? "category";
    return labelFor.get(`opt:${raw}`) ?? raw;
  }

  const dirty =
    title !== issue.title ||
    description !== (issue.description ?? "") ||
    status !== issue.status ||
    priority !== issue.priority ||
    type !== issue.type ||
    (categoryId || null) !== issue.category_id ||
    (assigneeId || null) !== issue.assignee_id ||
    customFields.some((f) => customValues[f.key] !== String((issue.custom_values ?? {})[f.key] ?? ""));

  function save() {
    if (!title.trim()) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, {
          title: title.trim(),
          description: description || null,
          status,
          priority,
          type,
          categoryId: categoryId || null,
          assigneeId: assigneeId || null,
          customValues,
        });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this issue permanently? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteIssueAction(slug, issue.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  function moveToDone() {
    setError(null);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, {
          title: title.trim(),
          description: description || null,
          status: "done",
          priority,
          type,
          categoryId: categoryId || null,
          assigneeId: assigneeId || null,
          customValues,
        });
        setStatus("done");
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
      }
    });
  }

  function postComment() {
    const body = commentBody.trim();
    if (!body) return;
    startComment(async () => {
      try {
        const c = await addCommentAction(slug, issue.id, body);
        setComments((prev) => [...prev, c]);
        setCommentBody("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to comment");
      }
    });
  }

  const fieldCls = "rounded-lg border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-50 disabled:text-neutral-500";

  // Governance facts.
  const overdue = isUnassignedOverdue(issue);
  const thresholdLabel = durMin(unassignedThresholdMs(issue.priority));

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-sm text-neutral-400">{issueKey}</span>
        {readOnly && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">read-only</span>}
        {saved && !dirty && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>

      {overdue && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unassigned for over {thresholdLabel} — assign an owner.
        </div>
      )}

      <input
        value={title}
        disabled={readOnly}
        onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base font-medium outline-none focus:border-neutral-900 disabled:bg-neutral-50"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">Assignee
          <select value={assigneeId} disabled={readOnly} onChange={(e) => { setAssigneeId(e.target.value); setSaved(false); }} className={fieldCls}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">Status
          <select value={status} disabled={readOnly} onChange={(e) => { setStatus(e.target.value); setSaved(false); }} className={fieldCls}>
            {orderedStatuses.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">Priority
          <select value={priority} disabled={readOnly} onChange={(e) => { setPriority(e.target.value); setSaved(false); }} className={fieldCls}>
            {priorities.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">Type
          <select value={type} disabled={readOnly} onChange={(e) => { setType(e.target.value); setSaved(false); }} className={fieldCls}>
            {types.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        {catOptions.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-neutral-500">Category
            <select value={categoryId} disabled={readOnly} onChange={(e) => { setCategoryId(e.target.value); setSaved(false); }} className={fieldCls}>
              <option value="">None</option>
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {customFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {customFields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs text-neutral-500">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
              {f.type === "select" ? (
                <select
                  value={customValues[f.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => { setCustomValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false); }}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={customValues[f.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => { setCustomValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false); }}
                  className={fieldCls}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <label className="mt-3 block text-xs text-neutral-500">Description
        <textarea
          value={description}
          disabled={readOnly}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
          rows={6}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-50"
        />
      </label>

      {/* Governance facts */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-neutral-50 p-3 text-xs sm:grid-cols-4">
        <div><dt className="text-neutral-400">Created</dt><dd className="text-neutral-700" title={new Date(issue.created_at).toLocaleString()}>{relTime(issue.created_at)}</dd></div>
        <div><dt className="text-neutral-400">Last update</dt><dd className="text-neutral-700" title={new Date(issue.updated_at).toLocaleString()}>{relTime(issue.updated_at)}</dd></div>
        <div><dt className="text-neutral-400">Age</dt><dd className="text-neutral-700">{ageSince(issue.created_at)}</dd></div>
        <div><dt className="text-neutral-400">Assignee</dt><dd className="text-neutral-700">{assigneeId ? (members.find((m) => m.userId === assigneeId)?.label ?? "—") : "Unassigned"}</dd></div>
      </dl>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!readOnly && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={pending || !dirty || !title.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            {status === "in_review" && (
              <button
                onClick={moveToDone}
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Move to Done
              </button>
            )}
          </div>
          {canDelete && (
            <button onClick={remove} disabled={pending} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40">
              Delete issue
            </button>
          )}
        </div>
      )}

      {/* Activity: append-only governance timeline + comments */}
      <section className="mt-8 border-t border-neutral-200 pt-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Activity</h2>

        <ul className="space-y-2.5">
          {events.map((e) => (
            <li key={e.id} className="text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{e.actorLabel ?? "Someone"}</span>{" "}
              {e.field === "details" ? (
                "edited the details"
              ) : (
                <>changed {e.field} from <span className="text-neutral-700">{eventValue(e.field, e.oldValue)}</span> to <span className="text-neutral-700">{eventValue(e.field, e.newValue)}</span></>
              )}{" "}
              · <span title={new Date(e.createdAt).toLocaleString()}>{relTime(e.createdAt)}</span>
            </li>
          ))}
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-neutral-800">{c.authorLabel ?? "Someone"}</span>
                <span className="text-neutral-400" title={new Date(c.createdAt).toLocaleString()}>{relTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{c.body}</p>
            </li>
          ))}
          {events.length === 0 && comments.length === 0 && (
            <li className="text-xs text-neutral-400">No activity yet.</li>
          )}
        </ul>

        {!readOnly && (
          <div className="mt-4">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              placeholder="Add a comment…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={postComment}
                disabled={commenting || !commentBody.trim()}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {commenting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
