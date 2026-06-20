"use client";

import { useState, useTransition } from "react";
import { updateProjectAction } from "./actions";

export default function ProjectEditPanel({
  slug,
  projectKey,
  name: initialName,
  description: initialDesc,
}: {
  slug: string;
  projectKey: string;
  name: string;
  description: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName(initialName);
    setDescription(initialDesc ?? "");
    setError(null);
    setOpen(false);
  }

  function save() {
    const trimName = name.trim();
    if (!trimName) { setError("Name cannot be blank."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await updateProjectAction(slug, projectKey, {
          name: trimName,
          description: description.trim() || null,
        });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-neutral-400 hover:text-neutral-600 transition"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">Edit project details</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="What is this project about?"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={reset}
            disabled={pending}
            className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
