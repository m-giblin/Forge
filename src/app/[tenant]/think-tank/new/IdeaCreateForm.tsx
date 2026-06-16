"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIdeaAction } from "../actions";
import { IDEA_TEMPLATES } from "@/lib/ideaTemplates";
import { PILL_MAP } from "@/lib/ai/pills";

interface Props {
  slug: string;
  thinkTankId: string;
  members: Array<{ id: string; name: string | null; email: string }>;
}

export default function IdeaCreateForm({ slug, thinkTankId, members }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function applyTemplate(templateId: string) {
    const tpl = IDEA_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setDescription(tpl.description);
    setSelectedTemplate(templateId);
    setShowTemplates(false);
  }

  function clearTemplate() {
    setDescription("");
    setSelectedTemplate(null);
  }

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

  const activeTpl = selectedTemplate ? IDEA_TEMPLATES.find((t) => t.id === selectedTemplate) : null;

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

      {/* Template picker */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <div className="flex items-center gap-2">
            {activeTpl && (
              <button
                type="button"
                onClick={clearTemplate}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Clear template
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTemplates((s) => !s)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showTemplates ? "Hide templates" : "Use a template ▾"}
            </button>
          </div>
        </div>

        {showTemplates && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {IDEA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl.id)}
                className={`rounded-lg border p-3 text-left text-sm transition hover:border-neutral-400 hover:bg-neutral-50 ${
                  selectedTemplate === tpl.id
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200"
                }`}
              >
                <span className="font-medium text-neutral-800">{tpl.label}</span>
                <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                  Suggested: {tpl.suggestedPillIds.map((id) => PILL_MAP.get(id)?.label ?? id).join(", ")}
                </p>
              </button>
            ))}
          </div>
        )}

        {activeTpl && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium">Suggested AI lenses:</span>
            {activeTpl.suggestedPillIds.map((id) => {
              const pill = PILL_MAP.get(id);
              return pill ? (
                <span key={id} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                  {pill.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        <textarea
          name="description"
          rows={10}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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

      {/* Review by date */}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Review by</label>
        <input
          name="review_by"
          type="date"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-400">Optional. Sets a date to revisit this idea.</p>
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
