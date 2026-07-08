"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extractCompetitorIdeasAction, type ExtractedCompetitorIdea } from "./actions";

interface Props {
  slug: string;
  thinkTankId: string;
}

export default function CompetitorImportModal({ slug, thinkTankId }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [extracted, setExtracted] = useState<ExtractedCompetitorIdea[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setContent("");
    setExtracted(null);
    setSelected(new Set());
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function handleExtract() {
    setError(null);
    startTransition(async () => {
      try {
        const results = await extractCompetitorIdeasAction(slug, content);
        setExtracted(results);
        // Pre-select all extracted ideas
        setSelected(new Set(results.map((_, i) => i)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Extraction failed. Please try again.");
      }
    });
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleImportSelected() {
    if (!extracted) return;
    const chosen = extracted.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;

    // Navigate to new idea form pre-filled with first selected idea.
    // If multiple selected, open them one at a time via URL params.
    const first = chosen[0];
    const params = new URLSearchParams({
      title: first.title,
      description: first.description,
      tags: first.tags.join(","),
    });
    // Store remaining in sessionStorage so user can import them after
    if (chosen.length > 1) {
      sessionStorage.setItem(
        "competitor_import_queue",
        JSON.stringify(chosen.slice(1))
      );
    } else {
      sessionStorage.removeItem("competitor_import_queue");
    }
    close();
    router.push(`/${slug}/think-tank/new?${params.toString()}&source=competitor&thinkTankId=${thinkTankId}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition"
      >
        <span>📥</span>
        Import from competitor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div>
                <p className="font-semibold text-neutral-900">📥 Import from competitor</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Paste a competitor&apos;s feature page, changelog, or product copy. AI extracts actionable ideas.
                </p>
              </div>
              <button
                onClick={close}
                className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!extracted ? (
                <>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isPending}
                    rows={10}
                    placeholder="Paste competitor feature page text, changelog, or product description here…&#10;&#10;Example: paste the full text of a competitor's 'What's new' page or feature list."
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 resize-none disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">
                      {content.length.toLocaleString()} / 20,000 chars
                    </span>
                    <div className="flex gap-3">
                      <button onClick={close} className="px-4 py-1.5 text-sm text-neutral-600 hover:text-neutral-900">
                        Cancel
                      </button>
                      <button
                        onClick={handleExtract}
                        disabled={isPending || !content.trim() || content.length > 20_000}
                        className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {isPending ? "Extracting…" : "Extract ideas"}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-700">
                      {extracted.length} idea{extracted.length !== 1 ? "s" : ""} extracted — select which to import:
                    </p>
                    <button
                      onClick={reset}
                      className="text-xs text-neutral-500 hover:text-neutral-800 underline"
                    >
                      Paste different content
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {extracted.map((idea, i) => (
                      <label
                        key={i}
                        className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
                          selected.has(i)
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleSelect(i)}
                          className="mt-0.5 shrink-0 accent-neutral-900"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 leading-snug">{idea.title}</p>
                          {idea.description && (
                            <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{idea.description}</p>
                          )}
                          {idea.tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {idea.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-neutral-400">
                      {selected.size} selected
                      {selected.size > 1 && " — will open one at a time"}
                    </span>
                    <div className="flex gap-3">
                      <button onClick={close} className="px-4 py-1.5 text-sm text-neutral-600 hover:text-neutral-900">
                        Cancel
                      </button>
                      <button
                        onClick={handleImportSelected}
                        disabled={selected.size === 0}
                        className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        Import selected →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
