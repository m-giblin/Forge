"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createIdeaAction, searchSimilarIdeasAction } from "../actions";
import { IDEA_TEMPLATES } from "@/lib/ideaTemplates";
import { PILL_MAP } from "@/lib/ai/pills";
import type { TenantIdeaTemplate } from "@/lib/repositories/ideas";

interface Props {
  slug: string;
  thinkTankId: string;
  members: Array<{ id: string; name: string | null; email: string }>;
  tenantTemplates?: TenantIdeaTemplate[];
  okrs?: Array<{ id: string; title: string; quarter: string | null }>;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New", researching: "Researching", maturing: "Maturing",
  ready: "Ready", converted: "Converted",
};

export default function IdeaCreateForm({ slug, thinkTankId, members, tenantTemplates = [], okrs = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTitle = searchParams.get("title") ?? "";
  const prefillDescription = searchParams.get("description") ?? "";
  const prefillTags = searchParams.get("tags") ?? "";
  const isCompetitorImport = searchParams.get("source") === "competitor";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(prefillDescription);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [titleValue, setTitleValue] = useState(prefillTitle);
  const [similarIdeas, setSimilarIdeas] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (titleValue.trim().length < 3) {
        setSimilarIdeas([]);
        return;
      }
      const results = await searchSimilarIdeasAction(slug, titleValue);
      if (!cancelled) setSimilarIdeas(results);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [titleValue, slug]);

  function applyTemplate(templateId: string) {
    const builtin = IDEA_TEMPLATES.find((t) => t.id === templateId);
    if (builtin) {
      setDescription(builtin.description);
      setSelectedTemplate(templateId);
      setShowTemplates(false);
      return;
    }
    const custom = tenantTemplates.find((t) => t.id === templateId);
    if (custom) {
      setDescription(custom.description);
      setSelectedTemplate(templateId);
      setShowTemplates(false);
    }
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

  const activeTpl = selectedTemplate
    ? (IDEA_TEMPLATES.find((t) => t.id === selectedTemplate) ??
       tenantTemplates.find((t) => t.id === selectedTemplate) ??
       null)
    : null;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {/* Competitor import notice */}
      {isCompetitorImport && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>📥</span>
          <span>Pre-filled from competitor import — review and edit before saving.</span>
        </div>
      )}
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
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          placeholder="What's the idea?"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        {similarIdeas.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1.5 text-xs font-medium text-amber-700">Similar ideas already exist — check before creating:</p>
            <ul className="space-y-1">
              {similarIdeas.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/${slug}/think-tank/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-amber-800 hover:underline"
                  >
                    <span className="font-medium">{s.title}</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-600">
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-amber-400">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          <div className="mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
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
                  {tpl.suggestedPillIds.length > 0 && (
                    <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                      Suggested: {tpl.suggestedPillIds.map((id) => PILL_MAP.get(id)?.label ?? id).join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
            {tenantTemplates.length > 0 && (
              <>
                <p className="text-xs font-medium text-neutral-400">Custom templates</p>
                <div className="grid grid-cols-2 gap-2">
                  {tenantTemplates.map((tpl) => (
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
                      {tpl.suggestedPillIds.length > 0 && (
                        <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                          Suggested: {tpl.suggestedPillIds.map((id) => PILL_MAP.get(id)?.label ?? id).join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
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
          defaultValue={prefillTags}
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

      {okrs.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Link to OKR <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <select
            name="linked_okr_id"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">No OKR alignment</option>
            {okrs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.quarter ? `[${o.quarter}] ` : ""}{o.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Private + anonymous toggles */}
      <div className="flex flex-wrap gap-4">
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
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="is_anonymous"
            className="h-4 w-4 rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">
            👤 Anonymous — hide my name from other members
          </span>
        </label>
      </div>

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
