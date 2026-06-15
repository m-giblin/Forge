"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIdeaAction } from "../actions";

interface Props {
  slug: string;
  thinkTankId: string;
  members: Array<{ id: string; name: string | null; email: string }>;
}

export default function IdeaCreateForm({ slug, thinkTankId, members }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const ideaId = await createIdeaAction(slug, thinkTankId, data);
        router.push(`/${slug}/think-tank/${ideaId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          autoFocus
          placeholder="What's the idea?"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Description
        </label>
        <textarea
          name="description"
          rows={6}
          placeholder="Describe the idea, the problem it solves, or any context that helps the team understand it…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-400">Markdown supported.</p>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Tags</label>
        <input
          name="tags"
          type="text"
          placeholder="e.g. product, growth, Q3 — comma-separated"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      {/* Assigned to */}
      {members.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Assign to
          </label>
          <select
            name="assigned_to"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Private toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="is_private"
          className="h-4 w-4 rounded border-neutral-300"
        />
        <span className="text-sm text-neutral-700">
          🔒 Private — only visible to me and admins
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create idea"}
        </button>
        <a
          href={`/${slug}/think-tank`}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
