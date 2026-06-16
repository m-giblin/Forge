"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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

// ── Inline SVG icons ──
const ICON_PATHS: Record<string, React.ReactNode> = {
  check: <polyline points="20 6 9 17 4 12" />,
  play: <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  circleCheck: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  bug: <><path d="M9 9V8a3 3 0 0 1 6 0v1" /><path d="M8 9h8a5 5 0 0 1 1 3v2a5 5 0 0 1-10 0v-2a5 5 0 0 1 1-3" /><path d="M3 13h4" /><path d="M17 13h4" /><path d="M12 20v-6" /><path d="m4 19 3-2" /><path d="m20 19-3-2" /><path d="m4 8 3 1.5" /><path d="m20 8-3 1.5" /></>,
  flame: <path d="M12 12c2-3 0-7-1-8 0 3-1.8 4.7-3 6s-2 3.2-2 5a6 6 0 1 0 12 0c0-1.5-1-3.9-2-5-1.8 3-2.8 3-4 2Z" />,
};

function Icon({ name, size = 16, className, strokeWidth = 2 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function statusIconName(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("backlog")) return "inbox";
  if (k.includes("progress") || k === "doing") return "play";
  if (k.includes("review")) return "eye";
  if (k.includes("done") || k.includes("closed") || k.includes("complete") || k.includes("resolved")) return "circleCheck";
  return "circle";
}

export default function IssueDetail({
  slug,
  issue,
  issueKey,
  projectKey,
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
  projectKey: string;
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
  const statusIdx = orderedStatuses.findIndex((o) => o.key === status);
  const statusPrev = orderedStatuses[statusIdx - 1];
  const statusNext = orderedStatuses[statusIdx + 1];
  const tops = categories.filter((c) => !c.parent_id);
  const catOptions = tops.flatMap((t) => [
    { id: t.id, label: t.name },
    ...categories.filter((c) => c.parent_id === t.id).map((s) => ({ id: s.id, label: `— ${s.name}` })),
  ]);

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

  function moveStatus(newStatus: string) {
    setError(null);
    setStatus(newStatus);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, {
          title: title.trim(),
          description: description || null,
          status: newStatus,
          priority,
          type,
          categoryId: categoryId || null,
          assigneeId: assigneeId || null,
          customValues,
        });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
        setStatus(status);
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

  const overdue = isUnassignedOverdue(issue);
  const thresholdLabel = durMin(unassignedThresholdMs(issue.priority));

  const isHotPriority = ["critical", "urgent", "high"].includes(priority);
  const priorityCls = ["critical", "urgent"].includes(priority)
    ? "bg-red-50 text-red-700"
    : priority === "high"
    ? "bg-orange-50 text-orange-700"
    : priority === "medium"
    ? "bg-amber-50 text-amber-700"
    : priority === "low"
    ? "bg-blue-50 text-blue-700"
    : "bg-neutral-100 text-neutral-600";

  const typeIsBug = type.toLowerCase().includes("bug");
  const sidebarSelect =
    "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500";
  const sideLabel = "mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500";
  const sideSection = "rounded-lg border border-neutral-200 bg-white p-4";

  const boardHref = `/${slug}/board?project=${projectKey}`;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* ── Header: breadcrumb ── */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm">
        <Link href={boardHref} className="text-neutral-400 hover:text-neutral-700" aria-label="Back to board">
          <Icon name="chevronLeft" size={16} />
        </Link>
        <Link href={boardHref} className="text-neutral-600 hover:text-neutral-900 font-medium">{projectKey}</Link>
        <span className="text-neutral-300">/</span>
        <Link href={boardHref} className="text-neutral-600 hover:text-neutral-900">Issues</Link>
        <span className="text-neutral-300">/</span>
        <span className="font-semibold text-neutral-900">{issueKey}</span>
        <div className="ml-auto flex items-center gap-3">
          {readOnly && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">read-only</span>}
          {saved && !dirty && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_270px] gap-0">
        {/* ── LEFT: main content ── */}
        <div className="bg-white p-6 space-y-6 md:border-r md:border-neutral-200">
          {overdue && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unassigned for over {thresholdLabel} — assign an owner.
            </div>
          )}

          {/* ─ Title + badges ─ */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              {type && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <Icon name={typeIsBug ? "bug" : "circle"} size={13} />
                  {types.find((t) => t.key === type)?.label ?? type}
                </span>
              )}
              {priority && (
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${priorityCls}`}>
                  {isHotPriority && <Icon name="flame" size={13} />}
                  {priorities.find((p) => p.key === priority)?.label ?? priority}
                </span>
              )}
              <span className="text-xs text-neutral-500 font-mono">{issueKey}</span>
            </div>
            <input
              value={title}
              disabled={readOnly}
              onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
              className="w-full text-2xl font-semibold text-neutral-900 outline-none border-0 p-0 disabled:bg-white"
            />
          </div>

          {/* ─ Status stepper section ─ */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
            <div className="flex items-start">
              {orderedStatuses.flatMap((s, i) => {
                const position = i < statusIdx ? "done" : i === statusIdx ? "current" : "pending";
                const isJumpable = !readOnly && !pending && position !== "current";
                const connectorBg = i === statusIdx ? "#2563EB" : i < statusIdx ? "#059669" : "#E5E7EB";

                const connector =
                  i > 0 ? (
                    <div key={`conn-${s.key}`} className="mt-[15px] h-px shrink-0" style={{ flex: "0.35", background: connectorBg }} />
                  ) : null;

                const node = (
                  <div
                    key={s.key}
                    role={isJumpable ? "button" : undefined}
                    tabIndex={isJumpable ? 0 : undefined}
                    onClick={() => isJumpable && moveStatus(s.key)}
                    onKeyDown={(e) => { if (isJumpable && (e.key === "Enter" || e.key === " ")) moveStatus(s.key); }}
                    title={isJumpable ? `Move to "${s.label}"` : undefined}
                    className={["flex min-w-0 flex-1 flex-col items-center gap-2", isJumpable ? "cursor-pointer" : "cursor-default"].join(" ")}
                  >
                    <div
                      className={[
                        "flex items-center justify-center rounded-full transition-all",
                        position === "done"
                          ? "h-8 w-8 bg-emerald-600 text-white shadow-sm"
                          : position === "current"
                          ? "h-10 w-10 bg-blue-600 text-white ring-4 ring-blue-100 shadow-md"
                          : isJumpable
                          ? "h-8 w-8 border-2 border-neutral-300 bg-white text-neutral-400 hover:border-neutral-400 hover:text-neutral-500 hover:shadow-sm"
                          : "h-8 w-8 border-2 border-neutral-200 bg-white text-neutral-300",
                      ].join(" ")}
                    >
                      <Icon name={position === "done" ? "check" : statusIconName(s.key)} size={position === "current" ? 18 : 16} />
                    </div>
                    <span
                      className={[
                        "text-center text-xs font-medium leading-tight",
                        position === "done"
                          ? "text-emerald-700"
                          : position === "current"
                          ? "text-blue-700"
                          : "text-neutral-500",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </div>
                );

                return connector ? [connector, node] : [node];
              })}
            </div>

            {!readOnly && (
              <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  disabled={!statusPrev || pending}
                  onClick={() => statusPrev && moveStatus(statusPrev.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40 transition"
                >
                  <Icon name="arrowLeft" size={14} />
                  {statusPrev?.label || "Start"}
                </button>
                <span className="text-xs text-neutral-500 font-medium">
                  Step {statusIdx + 1} of {orderedStatuses.length}
                </span>
                <button
                  type="button"
                  disabled={!statusNext || pending}
                  onClick={() => statusNext && moveStatus(statusNext.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
                >
                  {statusNext?.label || "Done"}
                  <Icon name="arrowRight" size={14} />
                </button>
              </div>
            )}
          </div>

          {/* ─ Description section ─ */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">Description</p>
            <textarea
              value={description}
              disabled={readOnly}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              rows={7}
              placeholder="Add a detailed description…"
              className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 disabled:bg-neutral-50"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {!readOnly && (
            <div className="flex items-center justify-between">
              <button
                onClick={save}
                disabled={pending || !dirty || !title.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
              {canDelete && (
                <button onClick={remove} disabled={pending} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40">
                  Delete issue
                </button>
              )}
            </div>
          )}

          {/* ─ Activity section ─ */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-600">Activity</p>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="text-xs text-neutral-600">
                  <span className="font-medium text-neutral-800">{e.actorLabel ?? "Someone"}</span>{" "}
                  {e.field === "details" ? (
                    "edited the details"
                  ) : (
                    <>changed {e.field} from <span className="text-neutral-800">{eventValue(e.field, e.oldValue)}</span> to <span className="text-neutral-800">{eventValue(e.field, e.newValue)}</span></>
                  )}{" "}
                  · <span title={new Date(e.createdAt).toLocaleString()}>{relTime(e.createdAt)}</span>
                </div>
              ))}
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="font-medium text-neutral-800">{c.authorLabel ?? "Someone"}</span>
                    <span className="text-neutral-500" title={new Date(c.createdAt).toLocaleString()}>{relTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">{c.body}</p>
                </div>
              ))}
              {events.length === 0 && comments.length === 0 && (
                <p className="text-xs text-neutral-500">No activity yet.</p>
              )}
            </div>

            {!readOnly && (
              <div className="mt-4">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={2}
                  placeholder="Add a comment…"
                  className="w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={postComment}
                    disabled={commenting || !commentBody.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition"
                  >
                    {commenting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: sidebar ── */}
        <aside className="bg-neutral-50 p-5 space-y-4 md:border-l md:border-neutral-200">
          <div className={sideSection}>
            <p className={sideLabel}>Assignee</p>
            <select value={assigneeId} disabled={readOnly} onChange={(e) => { setAssigneeId(e.target.value); setSaved(false); }} className={sidebarSelect}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
            </select>
          </div>

          <div className={sideSection}>
            <p className={sideLabel}>Priority</p>
            <select value={priority} disabled={readOnly} onChange={(e) => { setPriority(e.target.value); setSaved(false); }} className={sidebarSelect}>
              {priorities.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          <div className={sideSection}>
            <p className={sideLabel}>Type</p>
            <select value={type} disabled={readOnly} onChange={(e) => { setType(e.target.value); setSaved(false); }} className={sidebarSelect}>
              {types.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {catOptions.length > 0 && (
            <div className={sideSection}>
              <p className={sideLabel}>Category</p>
              <select value={categoryId} disabled={readOnly} onChange={(e) => { setCategoryId(e.target.value); setSaved(false); }} className={sidebarSelect}>
                <option value="">None</option>
                {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}

          {customFields.map((f) => (
            <div key={f.key} className={sideSection}>
              <p className={sideLabel}>{f.label}{f.required && <span className="text-red-500"> *</span>}</p>
              {f.type === "select" ? (
                <select
                  value={customValues[f.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => { setCustomValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false); }}
                  className={sidebarSelect}
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
                  className={sidebarSelect}
                />
              )}
            </div>
          ))}

          <div className={`${sideSection} space-y-3`}>
            <div>
              <p className={sideLabel}>Created</p>
              <p className="text-sm text-neutral-700 font-medium" title={new Date(issue.created_at).toLocaleString()}>{relTime(issue.created_at)}</p>
            </div>
            <div className="border-t border-neutral-200 pt-3">
              <p className={sideLabel}>Last update</p>
              <p className="text-sm text-neutral-700 font-medium" title={new Date(issue.updated_at).toLocaleString()}>{relTime(issue.updated_at)}</p>
            </div>
            <div className="border-t border-neutral-200 pt-3">
              <p className={sideLabel}>Age</p>
              <p className="text-sm text-neutral-700 font-medium">{ageSince(issue.created_at)}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
