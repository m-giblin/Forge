"use client";

import { useState, useTransition } from "react";
import type { ProjectWikiPage } from "@/lib/repositories/projects";
import { updateWikiAction } from "./actions";

interface Props {
  slug: string;
  projectKey: string;
  wiki: ProjectWikiPage | null;
  canEdit: boolean;
}

export default function WikiPanel({ slug, projectKey, wiki, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(wiki?.body ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleEdit() {
    setBody(wiki?.body ?? "");
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setBody(wiki?.body ?? "");
    setEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateWikiAction(slug, projectKey, body);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  const displayBody = editing ? body : (wiki?.body ?? "");
  const isEmpty = !wiki?.body?.trim();

  if (editing) {
    return (
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          placeholder="Write an overview, goals, context, decisions… Markdown supported."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {wiki?.title ?? "Overview"}
        </span>
        {canEdit && (
          <button
            onClick={handleEdit}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            {isEmpty ? "Start writing" : "Edit"}
          </button>
        )}
      </div>

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400">
          No wiki content yet.{" "}
          {canEdit && (
            <button onClick={handleEdit} className="text-blue-600 hover:underline">
              Start writing
            </button>
          )}
        </p>
      ) : (
        <div className="prose prose-sm max-w-none rounded-xl border border-neutral-200 bg-white px-5 py-4 text-neutral-800 shadow-sm">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {displayBody}
          </pre>
        </div>
      )}
      {wiki?.updatedAt && !isEmpty && (
        <p className="mt-1.5 text-right text-xs text-neutral-400">
          Last updated {new Date(wiki.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
