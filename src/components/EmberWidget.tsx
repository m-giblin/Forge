"use client";

import { useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { askEmberAction, confirmEmberCreateIssueAction } from "@/app/[tenant]/ember/actions";
import type { EmberSource, ProposedAction } from "@/lib/services/emberAssistant";
import { EMBER_TOURS } from "@/lib/emberTours";
import "driver.js/dist/driver.css";

async function runTour(sectionId: string) {
  const tour = EMBER_TOURS[sectionId];
  if (!tour) return;
  const { driver } = await import("driver.js");
  driver({
    showProgress: true,
    steps: tour.steps.map((s) => ({ element: s.selector, popover: { title: s.title, description: s.description } })),
  }).drive();
}

type ActionState = { status: "pending" } | { status: "created"; issueKey: string; issueId: string } | { status: "error"; message: string };

type Turn =
  | { question: string; answer: string; sources: EmberSource[]; proposedAction?: ProposedAction; actionState?: ActionState }
  | { question: string; error: string };

export default function EmberWidget({ slug }: { slug: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();
  const [confirming, startConfirmTransition] = useTransition();

  function submit() {
    const q = question.trim();
    if (!q || pending) return;
    setQuestion("");
    startTransition(async () => {
      try {
        const pathAndQuery = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
        const result = await askEmberAction(slug, q, pathAndQuery);
        setTurns((prev) => [
          ...prev,
          { question: q, answer: result.answer, sources: result.sources, proposedAction: result.proposedAction },
        ]);
      } catch (e) {
        setTurns((prev) => [...prev, { question: q, error: e instanceof Error ? e.message : "Something went wrong." }]);
      }
    });
  }

  function confirmAction(turnIndex: number, action: ProposedAction) {
    setTurns((prev) => prev.map((t, i) => (i === turnIndex && !("error" in t) ? { ...t, actionState: { status: "pending" } } : t)));
    startConfirmTransition(async () => {
      try {
        const issue = await confirmEmberCreateIssueAction(slug, action.projectId, action.title);
        setTurns((prev) =>
          prev.map((t, i) =>
            i === turnIndex && !("error" in t)
              ? { ...t, actionState: { status: "created", issueKey: `${action.projectKey}-${issue.number}`, issueId: issue.id } }
              : t
          )
        );
      } catch (e) {
        setTurns((prev) =>
          prev.map((t, i) =>
            i === turnIndex && !("error" in t)
              ? { ...t, actionState: { status: "error", message: e instanceof Error ? e.message : "Couldn't create the issue." } }
              : t
          )
        );
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
                Ask me how to do something in Forge, or ask me to create an issue while you&apos;re on a project page.
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

                    {t.proposedAction && (
                      <div className="mt-2 border-t border-neutral-200 pt-2">
                        {!t.actionState && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={confirming}
                              onClick={() => confirmAction(i, t.proposedAction!)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Create issue
                            </button>
                            <span className="text-[11px] text-neutral-400">in {t.proposedAction.projectKey}</span>
                          </div>
                        )}
                        {t.actionState?.status === "pending" && <p className="text-xs text-neutral-400">Creating…</p>}
                        {t.actionState?.status === "created" && (
                          <Link
                            href={`/${slug}/issues/${t.actionState.issueId}`}
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            ✓ Created {t.actionState.issueKey} →
                          </Link>
                        )}
                        {t.actionState?.status === "error" && <p className="text-xs text-rose-600">{t.actionState.message}</p>}
                      </div>
                    )}

                    {t.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-neutral-200 pt-2">
                        {t.sources.map((s) =>
                          s.kind === "doc" ? (
                            <span key={`doc-${s.sectionId}`} className="inline-flex items-center gap-1">
                              <Link
                                href={`/${slug}/docs#${s.sectionId}`}
                                className="rounded-full bg-white border border-violet-200 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                              >
                                📄 {s.sectionTitle} →
                              </Link>
                              {EMBER_TOURS[s.sectionId] && pathname.startsWith(EMBER_TOURS[s.sectionId].pathPrefix) && (
                                <button
                                  type="button"
                                  onClick={() => runTour(s.sectionId)}
                                  className="rounded-full bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
                                >
                                  ▶ Show me
                                </button>
                              )}
                            </span>
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
