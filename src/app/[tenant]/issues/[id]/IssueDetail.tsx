"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type Issue } from "@/lib/repositories/issues";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { type IssueComment, type IssueEvent } from "@/lib/repositories/issueActivity";
import { isUnassignedOverdue, unassignedThresholdMs } from "@/lib/sla";
import { updateIssueAction, deleteIssueAction, addCommentAction, watchIssueAction, unwatchIssueAction, saveIssueSpecAction, cascadeStatusToChildrenAction } from "./actions";
import { IssueSpecPanel } from "./IssueSpec";
import { IssueSignoffsPanel, type IssueSignoff } from "./IssueSignoffs";
import IssueAttachments from "./IssueAttachments";
import type { IssueAttachment } from "@/lib/repositories/issueAttachments";
import { SubIssuesCard, LinkedIssuesCard } from "./IssueHierarchy";
import type { IssueLinkWithKey } from "@/lib/repositories/issueLinks";
import TriageCard from "./TriageCard";
import GitLinksCard from "./GitLinksCard";
import MarkDuplicateButton from "./MarkDuplicateButton";
import { Icon, relTime, SideGroupLabel } from "./IssueDetailUI";
import IssueStatusPipeline from "./IssueStatusPipeline";
import IssuePeoplePanel from "./IssuePeoplePanel";
import IssueClassificationPanel from "./IssueClassificationPanel";
import IssuePlanningPanel from "./IssuePlanningPanel";
import IssueActivityFeed from "./IssueActivityFeed";
import IssueTimePanel from "./IssueTimePanel";
import type { TimeLog } from "./timeActions";
import { startIssueTimerAction, stopIssueTimerAction } from "./timeActions";
import type { IssueCodeLink } from "@/lib/repositories/gitIntegration";
import DecomposeButton from "./DecomposeButton";
import PrImpactButton from "./PrImpactButton";
import type { SlaTimer } from "@/lib/services/sla";

type Member = { userId: string; label: string };

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
  projectKey,
  statuses,
  priorities,
  types,
  categories,
  customFields,
  members,
  comments: initialComments,
  events,
  initialAttachments,
  readOnly,
  canDelete,
  userRole,
  watchers: initialWatchers,
  initialAssigneeIds = [],
  currentUserId,
  parentIssue,
  subIssues = [],
  links = [],
  gitLinks = [],
  slaTimer,
  signoffs = [],
  initialTimeLogs = [],
  initialTimerStartedAt = null,
  timeEstimateMinutes = null,
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
  initialAttachments: IssueAttachment[];
  readOnly: boolean;
  canDelete: boolean;
  userRole: string;
  watchers: string[];
  initialAssigneeIds?: string[];
  currentUserId: string;
  parentIssue?: { id: string; number: number; title: string; projects: { key: string } };
  subIssues?: { id: string; number: number; title: string; status: string; priority: string }[];
  links?: IssueLinkWithKey[];
  gitLinks?: IssueCodeLink[];
  slaTimer?: SlaTimer;
  signoffs?: IssueSignoff[];
  initialTimeLogs?: TimeLog[];
  initialTimerStartedAt?: string | null;
  timeEstimateMinutes?: number | null;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [status, setStatus] = useState(issue.status);
  const [priority, setPriority] = useState(issue.priority);
  const [type, setType] = useState(issue.type);
  const [categoryId, setCategoryId] = useState(issue.category_id ?? "");
  const [assigneeId, setAssigneeId] = useState(issue.assignee_id ?? "");
  const [startDate, setStartDate] = useState(issue.start_date ?? "");
  const [dueDate, setDueDate] = useState(issue.due_date ?? "");
  const [phase, setPhase] = useState(issue.phase ?? "");
  const [storyPoints, setStoryPoints] = useState<string>(issue.story_points != null ? String(issue.story_points) : "");
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    Object.fromEntries(customFields.map((f) => [f.key, String((issue.custom_values ?? {})[f.key] ?? "")]))
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Shared timer state — synced between the inline Activity button and the sidebar panel
  const [sharedTimerAt, setSharedTimerAt] = useState<string | null>(initialTimerStartedAt ?? null);
  const [timerPending, startTimerTransition] = useTransition();
  const [inlineTimerError, setInlineTimerError] = useState<string | null>(null);
  // Used to push an optimistic log entry into IssueTimePanel after Activity-header stop
  const [activityStopLog, setActivityStopLog] = useState<{ minutes: number; note: string } | null>(null);

  function handleInlineStart() {
    startTimerTransition(async () => {
      const res = await startIssueTimerAction(slug, issue.id);
      if (res.ok && res.startedAt) setSharedTimerAt(res.startedAt);
    });
  }

  function handleInlineStop() {
    setInlineTimerError(null);
    startTimerTransition(async () => {
      const res = await stopIssueTimerAction(slug, issue.id);
      if (res.ok) {
        setSharedTimerAt(null);
        if (res.minutesLogged && res.minutesLogged > 0) {
          setActivityStopLog({ minutes: res.minutesLogged, note: res.note ?? "" });
        }
      } else {
        setInlineTimerError(res.error ?? "Failed to stop timer");
      }
    });
  }

  // Auto-save a single sidebar field immediately on change
  function saveField(patch: Parameters<typeof updateIssueAction>[2]) {
    if (readOnly) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, patch);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  const [watchers, setWatchers] = useState<string[]>(initialWatchers);
  const [watchPending, startWatchTransition] = useTransition();
  const isWatching = watchers.includes(currentUserId);

  function toggleWatch() {
    startWatchTransition(async () => {
      try {
        if (isWatching) {
          await unwatchIssueAction(slug, issue.id);
          setWatchers((w) => w.filter((id) => id !== currentUserId));
        } else {
          await watchIssueAction(slug, issue.id);
          setWatchers((w) => [...w, currentUserId]);
        }
      } catch (e) {
        console.error("watch toggle failed", e);
      }
    });
  }

  const [comments, setComments] = useState<IssueComment[]>(initialComments);
  type SubIssue = { id: string; number: number; title: string; status: string; priority: string };
  const [liveSubIssues, setLiveSubIssues] = useState<SubIssue[]>(subIssues);
  const [cascadePrompt, setCascadePrompt] = useState<{ newStatus: string; count: number } | null>(null);
  const [cascading, startCascade] = useTransition();
  const [commentBody, setCommentBody] = useState("");
  const [commentType, setCommentType] = useState<"comment" | "decision">("comment");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToLabel, setReplyToLabel] = useState<string | null>(null);
  const [commenting, startComment] = useTransition();
  const canMarkDecision = userRole === "owner" || userRole === "admin";

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
    (startDate || null) !== issue.start_date ||
    (dueDate || null) !== issue.due_date ||
    (phase || null) !== issue.phase ||
    (storyPoints ? Number(storyPoints) : null) !== issue.story_points ||
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
          startDate: startDate || null,
          dueDate: dueDate || null,
          phase: phase || null,
          storyPoints: storyPoints ? Number(storyPoints) : null,
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
        // After saving parent, check if any children are on a different status
        const laggingChildren = liveSubIssues.filter((c) => c.status !== newStatus);
        if (laggingChildren.length > 0) {
          setCascadePrompt({ newStatus, count: laggingChildren.length });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
        setStatus(status);
      }
    });
  }

  function confirmCascade() {
    if (!cascadePrompt) return;
    const { newStatus } = cascadePrompt;
    setCascadePrompt(null);
    startCascade(async () => {
      await cascadeStatusToChildrenAction(slug, issue.id, newStatus);
      setLiveSubIssues((prev) => prev.map((c) => ({ ...c, status: newStatus })));
    });
  }

  function postComment() {
    const body = commentBody.trim();
    if (!body) return;
    startComment(async () => {
      try {
        const c = await addCommentAction(slug, issue.id, body, replyToId, commentType);
        setComments((prev) => [...prev, c]);
        setCommentBody("");
        setCommentType("comment");
        setReplyToId(null);
        setReplyToLabel(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to comment");
      }
    });
  }

  function startReply(commentId: string, authorLabel: string | null) {
    setReplyToId(commentId);
    setReplyToLabel(authorLabel);
    setCommentBody("");
  }

  function cancelReply() {
    setReplyToId(null);
    setReplyToLabel(null);
  }

  // Merge comments + events into one sorted timeline
  type TimelineItem =
    | { kind: "comment"; data: IssueComment }
    | { kind: "event"; data: IssueEvent };

  const timeline = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...comments.filter((c) => !c.parentId).map((c): TimelineItem => ({ kind: "comment", data: c })),
      ...events.map((e): TimelineItem => ({ kind: "event", data: e })),
    ];
    return items.sort((a, b) =>
      new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime()
    );
  }, [comments, events]);

  const repliesByParent = useMemo(() => {
    const map = new Map<string, IssueComment[]>();
    comments.filter((c) => c.parentId).forEach((c) => {
      const arr = map.get(c.parentId!) ?? [];
      arr.push(c);
      map.set(c.parentId!, arr);
    });
    return map;
  }, [comments]);

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
    <div className="overflow-clip rounded-xl border border-neutral-200 bg-white">
      {/* ── Header: breadcrumb ── */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm">
        <Link href={boardHref} className="text-neutral-400 hover:text-neutral-700" aria-label="Back to board">
          <Icon name="chevronLeft" size={16} />
        </Link>
        <Link href={boardHref} className="text-neutral-600 hover:text-neutral-900 font-medium">{projectKey}</Link>
        <span className="text-neutral-300">/</span>
        <Link href={boardHref} className="text-neutral-600 hover:text-neutral-900">Issues</Link>
        <span className="text-neutral-300">/</span>
        {parentIssue && (
          <>
            <Link
              href={`/${slug}/issues/${parentIssue.id}`}
              className="max-w-[200px] truncate text-neutral-600 hover:text-neutral-900"
              title={`${parentIssue.projects.key}-${parentIssue.number}: ${parentIssue.title}`}
            >
              {parentIssue.projects.key}-{parentIssue.number}: {parentIssue.title}
            </Link>
            <span className="text-neutral-300">/</span>
          </>
        )}
        <span className="font-semibold text-neutral-900">{issueKey}</span>
        <div className="ml-auto flex items-center gap-3">
          {readOnly && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">read-only</span>}
          {saved && !dirty && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] gap-0 md:items-start">
        {/* ── LEFT: main content ── */}
        <div className="bg-white p-6 space-y-6 md:border-r md:border-neutral-200">
          {overdue && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unassigned for over {thresholdLabel} — assign an owner.
            </div>
          )}

          {cascadePrompt && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-center justify-between gap-4">
              <span>
                This issue has <strong>{cascadePrompt.count} sub-issue{cascadePrompt.count !== 1 ? "s" : ""}</strong> not yet in <strong>{cascadePrompt.newStatus.replace("_", " ")}</strong>. Move them too?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={confirmCascade}
                  disabled={cascading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {cascading ? "Moving…" : "Yes, move all"}
                </button>
                <button
                  onClick={() => setCascadePrompt(null)}
                  className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  No thanks
                </button>
              </div>
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
              {phase && (
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                  {phase.charAt(0).toUpperCase() + phase.slice(1)}
                </span>
              )}
              <span className="text-xs text-neutral-500 font-mono">{issueKey}</span>
            </div>
            <div className="group flex items-start gap-3">
              <input
                value={title}
                disabled={readOnly}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) saveField({ title: e.target.value.trim() }); }}
                className="w-full text-2xl font-semibold text-neutral-900 outline-none border-0 p-0 disabled:bg-white focus:bg-neutral-50 rounded"
              />
              {!readOnly && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.focus()}
                  className="mt-1 flex-shrink-0 rounded-md p-1.5 text-amber-400 opacity-0 group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-600 transition-all"
                  title="Edit title"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* ─ Status pipeline ─ */}
          <IssueStatusPipeline
            orderedStatuses={orderedStatuses}
            statusIdx={statusIdx}
            statusPrev={statusPrev}
            statusNext={statusNext}
            readOnly={readOnly}
            pending={pending}
            onMoveStatus={moveStatus}
          />

          {/* ─ Description section ─ */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">Description</p>
            <textarea
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => saveField({ description: e.target.value || null })}
              rows={7}
              placeholder="Add a detailed description…"
              className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 disabled:bg-neutral-50"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {!readOnly && (
            <div className="flex items-center justify-between">
              <span className={`text-xs transition-colors ${pending ? "text-neutral-400" : saved ? "text-green-600 font-medium" : "text-neutral-400"}`}>
                {pending ? "Saving…" : saved ? "Saved ✓" : ""}
              </span>
              {canDelete && (
                <button onClick={remove} disabled={pending} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40">
                  Delete issue
                </button>
              )}
            </div>
          )}

          {/* ─ Spec / PRD section ─ */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <IssueSpecPanel
              slug={slug}
              issueId={issue.id}
              initialSpec={issue.spec_md ?? null}
              readOnly={readOnly}
            />
          </div>

          {/* ─ Sign-offs section ─ */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <IssueSignoffsPanel
              slug={slug}
              issueId={issue.id}
              signoffs={signoffs ?? []}
              readOnly={readOnly}
              userRole={userRole}
              currentUserId={currentUserId}
            />
          </div>

          {/* ─ Activity section ─ */}
          <IssueActivityFeed
            comments={comments}
            timeline={timeline}
            repliesByParent={repliesByParent}
            readOnly={readOnly}
            timerPending={timerPending}
            sharedTimerAt={sharedTimerAt}
            onInlineStart={handleInlineStart}
            onInlineStop={handleInlineStop}
            inlineTimerError={inlineTimerError}
            canMarkDecision={canMarkDecision}
            commentType={commentType}
            setCommentType={setCommentType}
            commentBody={commentBody}
            setCommentBody={setCommentBody}
            postComment={postComment}
            commenting={commenting}
            replyToId={replyToId}
            replyToLabel={replyToLabel}
            startReply={startReply}
            cancelReply={cancelReply}
            eventValue={eventValue}
          />
        </div>

        {/* ── RIGHT: sidebar — sticky so it stays in view as left scrolls ── */}
        <aside className="bg-neutral-50 p-5 space-y-4 md:border-l md:border-neutral-200 md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">

          {/* ── AI Actions ── */}
          {!readOnly && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-500 mb-3">✨ AI Actions</p>
              <TriageCard
                slug={slug}
                issueId={issue.id}
                suggestion={issue.triage_suggestion}
                readOnly={readOnly}
                inline
                onCommentAdded={(c) => setComments((prev) => [...prev, c])}
              />
              <DecomposeButton
                slug={slug}
                issueId={issue.id}
                projectId={issue.project_id}
                readOnly={readOnly}
              />
              <PrImpactButton
                slug={slug}
                issueId={issue.id}
                readOnly={readOnly}
                userRole={userRole}
                onSubIssuesCreated={(items) => setLiveSubIssues((prev) => [...prev, ...items])}
                onCommentAdded={(c) => setComments((prev) => [...prev, c])}
              />
              {/* Persistent PR Impact badge */}
              {issue.latest_pr_impact && (() => {
                const imp = issue.latest_pr_impact;
                const risk = imp.risk;
                const gate = imp.gateState;
                const cfg = {
                  critical: { bar: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50 border-red-200",    label: "🔴 Critical risk" },
                  high:     { bar: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "🟠 High risk" },
                  medium:   { bar: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", label: "🟡 Medium risk" },
                  low:      { bar: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50 border-green-200",  label: "🟢 Low risk" },
                }[risk] ?? { bar: "bg-neutral-300", text: "text-neutral-600", bg: "bg-neutral-50 border-neutral-200", label: risk };
                const gateLabel = gate === "open" ? " · 🚨 Gate open" : gate === "approved" ? " · ✅ Approved" : gate === "denied" ? " · ❌ Denied" : "";
                return (
                  <div className={`rounded-lg border px-3 py-2 ${cfg.bg}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}{gateLabel}</p>
                      <span className="text-[10px] text-neutral-400">{new Date(imp.ranAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-0.5 line-clamp-2">{imp.summary}</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── 👥 People ── */}
          <IssuePeoplePanel
            slug={slug}
            issueId={issue.id}
            members={members}
            assigneeId={assigneeId}
            initialAssigneeIds={initialAssigneeIds}
            readOnly={readOnly}
            watchers={watchers}
            watchPending={watchPending}
            isWatching={isWatching}
            setAssigneeId={setAssigneeId}
            saveField={saveField}
            toggleWatch={toggleWatch}
          />

          {/* ── 🏷 Classification ── */}
          <IssueClassificationPanel
            priority={priority}
            type={type}
            categoryId={categoryId}
            priorities={priorities}
            types={types}
            catOptions={catOptions}
            customFields={customFields}
            customValues={customValues}
            readOnly={readOnly}
            setPriority={setPriority}
            setType={setType}
            setCategoryId={setCategoryId}
            setCustomValues={setCustomValues}
            saveField={saveField}
          />

          {/* ── 📅 Planning ── */}
          <IssuePlanningPanel
            startDate={startDate}
            dueDate={dueDate}
            phase={phase}
            storyPoints={storyPoints}
            readOnly={readOnly}
            slaTimer={slaTimer}
            setStartDate={setStartDate}
            setDueDate={setDueDate}
            setPhase={setPhase}
            setStoryPoints={setStoryPoints}
            saveField={saveField}
          />

          {/* ── 🔗 Relationships ── */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
            <SideGroupLabel color="text-purple-600">🔗 Relationships</SideGroupLabel>

            {/* Parent issue */}
            {parentIssue && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Parent issue</p>
                <Link
                  href={`/${slug}/issues/${parentIssue.id}`}
                  className="flex items-center gap-2 group"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                  <span className="font-mono text-[11px] text-neutral-400 shrink-0">
                    {parentIssue.projects.key}-{parentIssue.number}
                  </span>
                  <span className="text-xs text-neutral-700 group-hover:text-neutral-900 truncate">
                    {parentIssue.title}
                  </span>
                </Link>
              </div>
            )}

            <SubIssuesCard
              slug={slug}
              parentIssueId={issue.id}
              projectId={issue.project_id}
              projectKey={projectKey}
              subIssues={liveSubIssues}
              readOnly={readOnly}
              tooltip="Child tasks that must all be completed as part of resolving this issue. Useful for breaking a large issue into trackable steps."
            />
            <LinkedIssuesCard
              slug={slug}
              issueId={issue.id}
              links={links}
              readOnly={readOnly}
              tooltip="Issues related to this one — blocks, is blocked by, duplicates, or references. Helps the team see knock-on effects."
            />
            <MarkDuplicateButton
              slug={slug}
              issueId={issue.id}
              currentStatus={issue.status}
              readOnly={readOnly}
              tooltip="Flag this issue as a duplicate of an existing one. The duplicate is closed and a reference is kept so nothing gets lost."
            />
          </div>

          {/* ── ⏱ Time Tracking ── */}
          <IssueTimePanel
            slug={slug}
            issueId={issue.id}
            initialLogs={initialTimeLogs}
            timeEstimateMinutes={timeEstimateMinutes ?? null}
            initialTimerStartedAt={initialTimerStartedAt ?? null}
            controlledTimerAt={sharedTimerAt}
            onTimerChange={setSharedTimerAt}
            activityStopLog={activityStopLog}
            onActivityStopConsumed={() => setActivityStopLog(null)}
            readOnly={readOnly}
          />

          <GitLinksCard links={gitLinks} />

          {/* ── 📋 Details ── */}
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
            <SideGroupLabel color="text-rose-500">📋 Details</SideGroupLabel>
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-neutral-500">Created</p>
              <p className="text-xs text-neutral-800 font-semibold bg-white border border-rose-100 rounded-md px-2 py-0.5" title={new Date(issue.created_at).toLocaleString()}>{relTime(issue.created_at)}</p>
            </div>
            <div className="flex justify-between items-center border-t border-rose-100 pt-3">
              <p className="text-xs font-semibold text-neutral-500">Last update</p>
              <p className="text-xs text-neutral-800 font-semibold bg-white border border-rose-100 rounded-md px-2 py-0.5" title={new Date(issue.updated_at).toLocaleString()}>{relTime(issue.updated_at)}</p>
            </div>
            <div className="flex justify-between items-center border-t border-rose-100 pt-3">
              <p className="text-xs font-semibold text-neutral-500">Age</p>
              <p className="text-xs text-neutral-800 font-semibold bg-white border border-rose-100 rounded-md px-2 py-0.5">{ageSince(issue.created_at)}</p>
            </div>
            {issue.environment && (() => {
              let meta: Record<string, string | number | boolean> | null = null;
              try { meta = JSON.parse(issue.environment); } catch { /* plain string */ }
              return (
                <div className="border-t border-neutral-200 pt-3">
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-700 select-none list-none flex items-center gap-1">
                      <span className="text-[10px]">▶</span> Technical details
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {meta ? Object.entries(meta).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</span>
                          <span className="text-xs text-neutral-600 break-all font-mono leading-tight">{String(v)}</span>
                        </div>
                      )) : (
                        <span className="text-xs text-neutral-600 break-all font-mono">{issue.environment}</span>
                      )}
                    </div>
                  </details>
                </div>
              );
            })()}
            <div className="border-t border-neutral-200 pt-3">
              <IssueAttachments
                slug={slug}
                issueId={issue.id}
                initialAttachments={initialAttachments}
                readOnly={readOnly}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
