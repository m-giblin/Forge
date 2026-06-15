"use client";

import { useState, useTransition } from "react";
import { updateIdeaAction, advanceStatusAction, convertIdeaAction } from "../actions";
import type { IdeaRow, IdeaComment, IdeaAiTurn } from "@/lib/repositories/ideas";
import IdeaComments from "./IdeaComments";
import SoundingBoard from "./SoundingBoard";

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
  lastAiTurn: IdeaAiTurn | null;
}

export default function IdeaDetail({ slug, idea, canEdit, members, thinkTankName, comments, currentUserId, isAdmin, isViewer, lastAiTurn }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertedProject, setConvertedProject] = useState<{ id: string; key: string } | null>(null);

  const meta = STATUS_META[idea.status] ?? STATUS_META.new;
  const nextOptions = NEXT_STATUS[idea.status] ?? [];
  const isTerminal = idea.status === "converted" || idea.status === "archived";
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
            {idea.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {idea.tags.map((t) => (
                  <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {canEdit && !isTerminal && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Edit
          </button>
        )}
      </div>

      {/* Feedback */}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

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
                href={`/${slug}/projects/${convertedProject.id}`}
                className="font-semibold underline hover:no-underline"
              >
                {convertedProject.key} — View Project →
              </a>
            </span>
          ) : idea.status === "converted" ? (
            <span>
              ✅ This idea has been converted to a project.
              {idea.linked_project_id && (
                <>
                  {" "}
                  <a
                    href={`/${slug}/projects/${idea.linked_project_id}`}
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

      <SoundingBoard
        slug={slug}
        ideaId={idea.id}
        isViewer={isViewer}
        lastTurn={lastAiTurn}
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
