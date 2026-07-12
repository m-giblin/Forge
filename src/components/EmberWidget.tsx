"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askEmberAction } from "@/app/[tenant]/ember/actions";
import type { EmberSource } from "@/lib/services/emberAssistant";

type Turn = { question: string; answer: string; sources: EmberSource[] } | { question: string; error: string };

export default function EmberWidget({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();

  function submit() {
    const q = question.trim();
    if (!q || pending) return;
    setQuestion("");
    startTransition(async () => {
      try {
        const result = await askEmberAction(slug, q);
        setTurns((prev) => [...prev, { question: q, answer: result.answer, sources: result.sources }]);
      } catch (e) {
        setTurns((prev) => [...prev, { question: q, error: e instanceof Error ? e.message : "Something went wrong." }]);
      }
    });
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-violet-700"
        >
          <span aria-hidden>✦</span> Ask Ember
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-violet-600 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">✦ Ember</p>
              <p className="text-[11px] text-violet-100">🔒 Only searches your workspace — docs &amp; wiki</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-lg leading-none">
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {turns.length === 0 && (
              <p className="text-sm text-neutral-400 mt-6 text-center">
                Ask me how to do something in Forge — I&apos;ll answer from the docs and link you straight to the section.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-1.5">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-3 py-2 text-sm text-white">{t.question}</p>
                {"error" in t ? (
                  <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700">
                    {t.error}
                  </p>
                ) : (
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-neutral-50 border border-neutral-100 px-3 py-2">
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap">{t.answer}</p>
                    {t.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-neutral-200 pt-2">
                        {t.sources.map((s) =>
                          s.kind === "doc" ? (
                            <Link
                              key={`doc-${s.sectionId}`}
                              href={`/${slug}/docs#${s.sectionId}`}
                              className="rounded-full bg-white border border-violet-200 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                            >
                              📄 {s.sectionTitle} →
                            </Link>
                          ) : (
                            <Link
                              key={`wiki-${s.pageId}`}
                              href={`/${slug}/spaces/${s.spaceId}/${s.pageId}`}
                              className="rounded-full bg-white border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                            >
                              📚 {s.pageTitle} →
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {pending && <p className="text-xs text-neutral-400">Ember is thinking…</p>}
          </div>

          <div className="border-t border-neutral-100 p-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="How do I create a sprint?"
                className="flex-1 min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <button
                type="button"
                onClick={submit}
                disabled={pending || !question.trim()}
                className="rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
