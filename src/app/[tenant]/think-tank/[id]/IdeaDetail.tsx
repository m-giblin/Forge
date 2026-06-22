"use client";

import { useState, useTransition } from "react";
import { updateIdeaAction, advanceStatusAction, convertIdeaAction } from "../actions";
import type { IdeaRow, IdeaComment, IdeaAiTurn, IdeaDecision, IdeaSignoff } from "@/lib/repositories/ideas";
import { SIGNOFF_ROLES } from "@/lib/repositories/ideas";
import type { Pill } from "@/lib/ai/pills";
import IdeaComments from "./IdeaComments";
import SoundingBoard from "./SoundingBoard";
import IdeaDecisions from "./IdeaDecisions";
import IdeaSignoffs from "./IdeaSignoffs";
import IdeaPRDPanel from "./IdeaPRDPanel";

const STATUS_META: Record<string, { label: string; color: string }> = {
  new:         { label: "New",         color: "bg-neutral-100 text-neutral-600" },
  researching: { label: "Researching", color: "bg-blue-100 text-blue-700" },
  maturing:    { label: "Maturing",    color: "bg-yellow-100 text-yellow-700" },
  ready:       { label: "Ready",       color: "bg-green-100 text-green-700" },
  converted:   { label: "Converted",   color: "bg-purple-100 text-purple-700" },
  archived:    { label: "Archived",    color: "bg-neutral-100 text-neutral-400" },
};

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  new:         [{ label: "Start researching →", value: "researching" }, { label: "Archive", value: "archived" }],
  researching: [{ label: "Mark as maturing →", value: "maturing" },    { label: "Archive", value: "archived" }],
  maturing:    [{ label: "Mark as ready →",     value: "ready" },       { label: "Archive", value: "archived" }],
  ready:       [{ label: "Archive", value: "archived" }],
};

interface Props {
  slug: string;
  idea: IdeaRow & { number: number | null; creator_name: string | null; assignee_name: string | null };
  canEdit: boolean;
  members: Array<{ id: string; name: string | null; email: string }>;
  thinkTankName: string;
  comments: IdeaComment[];
  currentUserId: string;
  isAdmin: boolean;
  isViewer: boolean;
  recentAiTurns: IdeaAiTurn[];
  linkedProjectKey: string | null;
  provenanceProject: { key: string; name: string; open: number; done: number; total: number } | null;
  customPills: Pill[];
  decisions: IdeaDecision[];
  signoffs: IdeaSignoff[];
}

export default function IdeaDetail({ slug, idea, canEdit, members, thinkTankName, comments, currentUserId, isAdmin, isViewer, recentAiTurns, linkedProjectKey, provenanceProject, customPills, decisions, signoffs }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertedProject, setConvertedProject] = useState<{ id: string; key: string } | null>(null);

  const meta = STATUS_META[idea.status] ?? STATUS_META.new;
  const nextOptions = NEXT_STATUS[idea.status] ?? [];
  const isTerminal = idea.status === "converted" || idea.status === "archived";
  const daysSinceUpdate = (new Date().getTime() - new Date(idea.updated_at).getTime()) / 86_400_000;
  const activeCommentCount = comments.filter((c) => !c.isDeleted).length;
  const approvedSignoffs = signoffs.length;
  const signoffsComplete = approvedSignoffs >= SIGNOFF_ROLES.length;

  // Maturity hint — computed from available props
  const maturityHint = (() => {
    if (isTerminal) return null;
    if (!idea.description || idea.description.trim().length <= 20) return "Add a description to help the team understand this idea.";
    if (comments.filter(c => !c.isDeleted).length === 0) return "Start a discussion — add the first comment.";
    if (recentAiTurns.length === 0) return "Run the AI Sounding Board to get an outside perspective.";
    if (!idea.assigned_to) return "Assign an owner to move this idea forward.";
    return null;
  })();
  const ideaKey = idea.number != null ? `${thinkTankName.slice(0, 2).toUpperCase()}-${idea.number}` : null;

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateIdeaAction(slug, idea.id, data);
        setEditing(false);
        setSuccessMsg("Saved.");
        setTimeout(() => setSuccessMsg(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  function handleConvert() {
    setError(null);
    setShowConvertModal(false);
    startTransition(async () => {
      try {
        const result = await convertIdeaAction(slug, idea.id);
        setConvertedProject({ id: result.projectId, key: result.projectKey });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Conversion failed.");
      }
    });
  }

  function handleAdvance(newStatus: string) {
    setError(null);
    startTransition(async () => {
      try {
        await advanceStatusAction(slug, idea.id, newStatus);
        setSuccessMsg(newStatus === "archived" ? "Idea archived." : "Status updated.");
        setTimeout(() => setSuccessMsg(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
        <a href={`/${slug}/think-tank`} className="hover:text-neutral-600">Think Tank</a>
        <span>/</span>
        {ideaKey && <span className="font-mono text-neutral-500">{ideaKey}</span>}
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-900">
            {idea.is_private && <span className="mr-2 text-neutral-400">🔒</span>}
            {idea.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
              {meta.label}
            </span>
            {idea.creator_name && <span>by {idea.creator_name}</span>}
            {idea.assignee_name && <span>· assigned to {idea.assignee_name}</span>}
            {idea.review_by && <ReviewByChip reviewBy={idea.review_by} />}
            {idea.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {idea.tags.map((t) => (
                  <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{t}</span>
                ))}
              </div>
            )}
          </div>
          {maturityHint && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
              <span>💡</span>
              <span>{maturityHint}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/${slug}/think-tank/${idea.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            title="Open print view — save as PDF from browser"
          >
            Export
          </a>
          {canEdit && !isTerminal && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Decision-driven pipeline (Design C) */}
      <PipelineStepper
        status={idea.status}
        hasDiscussion={activeCommentCount > 0}
        hasDecisions={decisions.length > 0}
        approvedSignoffs={approvedSignoffs}
        totalSignoffs={SIGNOFF_ROLES.length}
      />

      {/* Edit form */}
      {editing ? (
        <form onSubmit={handleEdit} className="mb-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Title</label>
            <input
              name="title"
              defaultValue={idea.title}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Description</label>
            <textarea
              name="description"
              defaultValue={idea.description ?? ""}
              rows={8}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Tags</label>
            <input
              name="tags"
              defaultValue={idea.tags.join(", ")}
              placeholder="comma-separated"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          {members.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Assign to</label>
              <select
                name="assigned_to"
                defaultValue={idea.assigned_to ?? ""}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Review by</label>
            <input
              name="review_by"
              type="date"
              defaultValue={idea.review_by ?? ""}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-400">Optional. Clear to remove.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="is_private" defaultChecked={idea.is_private} className="h-4 w-4 rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">🔒 Private</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isPending} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {isPending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        /* Description read view */
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          {idea.description ? (
            <p className="whitespace-pre-wrap text-sm text-neutral-700 leading-relaxed">{idea.description}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">No description yet.{canEdit && !isTerminal && " Click Edit to add one."}</p>
          )}
        </div>
      )}

      {/* Status workflow */}
      {!isTerminal && (nextOptions.length > 0 || idea.status === "ready") && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Move idea forward</p>
          {(idea.status === "maturing" || idea.status === "ready") && !signoffsComplete && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {approvedSignoffs} of {SIGNOFF_ROLES.length} sign-offs collected
              {decisions.length === 0 && " · no decisions logged yet"} — you can still proceed, but alignment isn&apos;t complete.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {idea.status === "ready" && (
              <button
                onClick={() => setShowConvertModal(true)}
                disabled={isPending}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Convert to project →
              </button>
            )}
            {nextOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleAdvance(opt.value)}
                disabled={isPending}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  opt.value === "archived"
                    ? "border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Convert confirmation modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-neutral-900">Convert to project?</h2>
            <p className="mb-5 text-sm text-neutral-500">
              A new project will be created from <strong>{idea.title}</strong>. The idea will be marked as converted and locked from further editing.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConvert}
                disabled={isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isPending ? "Converting…" : "Yes, convert"}
              </button>
              <button
                onClick={() => setShowConvertModal(false)}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {(isTerminal || convertedProject) && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${
          idea.status === "converted" || convertedProject
            ? "border-purple-200 bg-purple-50 text-purple-700"
            : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}>
          {convertedProject ? (
            <span>
              ✅ Converted to project{" "}
              <a
                href={`/${slug}/projects/${convertedProject.key}`}
                className="font-semibold underline hover:no-underline"
              >
                {convertedProject.key} — View Project →
              </a>
            </span>
          ) : idea.status === "converted" ? (
            <span>
              ✅ This idea has been converted to a project.
              {linkedProjectKey && (
                <>
                  {" "}
                  <a
                    href={`/${slug}/projects/${linkedProjectKey}`}
                    className="font-semibold underline hover:no-underline"
                  >
                    View Project →
                  </a>
                </>
              )}
            </span>
          ) : (
            "📦 This idea is archived."
          )}
        </div>
      )}

      {/* Provenance chain — idea → project → issues (only when converted) */}
      {provenanceProject && (
        <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-purple-700">Provenance chain</p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Idea node */}
            <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2">
              <span className="text-base">💡</span>
              <div>
                <p className="text-[10px] font-bold uppercase text-purple-500">Idea</p>
                <p className="text-xs font-semibold text-neutral-800 max-w-[160px] truncate">{idea.title}</p>
              </div>
            </div>
            {/* Arrow */}
            <span className="text-purple-400 font-bold text-lg">→</span>
            {/* Project node */}
            <a
              href={`/${slug}/projects/${provenanceProject.key}`}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 hover:border-purple-400 transition"
            >
              <span className="text-base">📋</span>
              <div>
                <p className="text-[10px] font-bold uppercase text-purple-500">Project · {provenanceProject.key}</p>
                <p className="text-xs font-semibold text-neutral-800 max-w-[160px] truncate">{provenanceProject.name}</p>
              </div>
            </a>
            {/* Arrow */}
            <span className="text-purple-400 font-bold text-lg">→</span>
            {/* Issues node */}
            <a
              href={`/${slug}/issues?project=${provenanceProject.key}`}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 hover:border-purple-400 transition"
            >
              <span className="text-base">🐛</span>
              <div>
                <p className="text-[10px] font-bold uppercase text-purple-500">Issues</p>
                <p className="text-xs font-semibold text-neutral-800">
                  {provenanceProject.open} open · {provenanceProject.done} done
                </p>
              </div>
            </a>
          </div>
          {provenanceProject.total === 0 && (
            <p className="mt-2 text-xs text-purple-500">No issues created yet in this project.</p>
          )}
        </div>
      )}

      <SoundingBoard
        slug={slug}
        ideaId={idea.id}
        isViewer={isViewer}
        initialTurns={recentAiTurns}
        customPills={customPills}
      />

      {/* Idea-to-PRD — shown when idea is approved/ready and not yet converted */}
      {!isViewer && !isTerminal && (idea.status === "approved" || idea.status === "ready") && (
        <IdeaPRDPanel slug={slug} ideaId={idea.id} ideaTitle={idea.title} />
      )}

      {/* AI Facilitator hints — shown when AI hasn't been used and conditions are met */}
      {!isViewer && !isTerminal && recentAiTurns.length === 0 && activeCommentCount >= 20 && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <span className="font-medium">🤖 AI suggestion:</span> Your discussion has {activeCommentCount} comments — the Sounding Board can help synthesize key themes and surface next steps.
        </div>
      )}
      {!isViewer && !isTerminal && recentAiTurns.length === 0 && activeCommentCount < 20 && daysSinceUpdate >= 14 && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="font-medium">🤖 AI suggestion:</span> This idea hasn&apos;t had AI input yet. Try the Sounding Board below — pick a lens to challenge or sharpen it.
        </div>
      )}

      <IdeaDecisions
        slug={slug}
        ideaId={idea.id}
        decisions={decisions}
        isAdmin={isAdmin}
      />

      <IdeaSignoffs
        slug={slug}
        ideaId={idea.id}
        signoffs={signoffs}
        canSign={!isViewer && !isTerminal}
      />

      <IdeaComments
        slug={slug}
        ideaId={idea.id}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        initialComments={comments}
      />
    </div>
  );
}

// The decision-driven flow, made visible: Discuss → Decide → Sign off → Ready
// → Converted. Each step shows done (✓), active (ring), or pending.
function PipelineStepper({
  status,
  hasDiscussion,
  hasDecisions,
  approvedSignoffs,
  totalSignoffs,
}: {
  status: string;
  hasDiscussion: boolean;
  hasDecisions: boolean;
  approvedSignoffs: number;
  totalSignoffs: number;
}) {
  const isReady = status === "ready" || status === "converted";
  const isConverted = status === "converted";
  const terminal = isConverted || status === "archived";
  const signoffsComplete = approvedSignoffs >= totalSignoffs;

  // A converted idea reached the end — show the whole journey complete.
  const steps = [
    { key: "discuss", label: "Discuss", done: hasDiscussion || isConverted },
    { key: "decide", label: "Decide", done: hasDecisions || isConverted },
    { key: "signoff", label: "Sign off", done: signoffsComplete || isConverted, note: `${approvedSignoffs}/${totalSignoffs}` },
    { key: "ready", label: "Ready", done: isReady },
    { key: "converted", label: "Converted", done: isConverted },
  ];
  // First not-done step is "active" — but a terminal idea has no current step.
  const activeIdx = terminal ? -1 : steps.findIndex((s) => !s.done);

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      {steps.map((s, i) => {
        const active = i === activeIdx;
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done
                    ? "bg-green-600 text-white"
                    : active
                    ? "border-2 border-neutral-900 text-neutral-900"
                    : "border border-neutral-300 text-neutral-400"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </div>
              <span className={`mt-1 text-[11px] ${active ? "font-semibold text-neutral-900" : "text-neutral-500"}`}>
                {s.label}
              </span>
              {s.note && !s.done && <span className="text-[10px] text-neutral-400">{s.note}</span>}
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 ${s.done ? "bg-green-500" : "bg-neutral-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewByChip({ reviewBy }: { reviewBy: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = reviewBy < today;
  const isToday = reviewBy === today;
  const label = isOverdue
    ? `⚠ Review overdue · ${new Date(reviewBy + "T12:00:00").toLocaleDateString()}`
    : isToday
    ? `⚠ Review today`
    : `📅 Review by ${new Date(reviewBy + "T12:00:00").toLocaleDateString()}`;
  const cls = isOverdue || isToday
    ? "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
    : "rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600";
  return <span className={cls}>{label}</span>;
}
