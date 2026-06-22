"use client";

import { useState, useTransition } from "react";
import { decomposeIssueAction, createSubIssuesAction } from "./decomposeAction";
import { useRouter } from "next/navigation";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high:   "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low:    "bg-neutral-50 text-neutral-600 border-neutral-200",
};

const TYPE_ICON: Record<string, string> = {
  feature: "✨",
  bug: "🐛",
  task: "✅",
};

interface SubIssueDraft {
  title: string;
  description: string;
  type: "task" | "feature" | "bug";
  priority: "low" | "medium" | "high" | "urgent";
}

interface Props {
  slug: string;
  issueId: string;
  projectId: string;
  readOnly: boolean;
}

export default function DecomposeButton({ slug, issueId, projectId, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<SubIssueDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"idle" | "generating" | "review" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (readOnly) return null;

  function handleOpen() {
    setOpen(true);
    setStep("generating");
    setError(null);
    setDrafts([]);
    setSelected(new Set());

    startTransition(async () => {
      try {
        const result = await decomposeIssueAction(slug, issueId);
        if (result.error) {
          setError(result.error);
          setStep("idle");
        } else {
          setDrafts(result.subIssues);
          setSelected(new Set(result.subIssues.map((_, i) => i)));
          setStep("review");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStep("idle");
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

  function handleCreate() {
    const chosen = drafts.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;

    startTransition(async () => {
      try {
        await createSubIssuesAction(slug, issueId, projectId, chosen);
        setStep("done");
        router.refresh();
        setTimeout(() => {
          setOpen(false);
          setStep("idle");
        }, 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create sub-issues.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
      >
        <span>🤖</span>
        AI Decompose
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <p className="font-semibold text-neutral-900">AI Issue Decomposer</p>
                <p className="text-xs text-neutral-500 mt-0.5">Break this issue into actionable sub-tasks</p>
              </div>
              <button onClick={() => { setOpen(false); setStep("idle"); }} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
            </div>

            <div className="px-5 py-5">
              {step === "generating" && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                  <p className="text-sm text-neutral-500">Analysing issue with Grok…</p>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
              )}

              {step === "review" && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 mb-3">
                    Select sub-tasks to create. Uncheck any you don&apos;t need.
                  </p>
                  {drafts.map((d, i) => (
                    <label
                      key={i}
                      className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        selected.has(i)
                          ? "border-indigo-200 bg-indigo-50"
                          : "border-neutral-200 bg-white opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                        className="mt-1 shrink-0 accent-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm">{TYPE_ICON[d.type] ?? "✅"}</span>
                          <p className="text-sm font-medium text-neutral-900">{d.title}</p>
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-2">{d.description}</p>
                        <div className="flex gap-2 mt-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLOR[d.priority] ?? ""}`}>
                            {d.priority}
                          </span>
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-500">
                            {d.type}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {step === "done" && (
                <div className="flex flex-col items-center py-8 gap-2">
                  <span className="text-4xl">✅</span>
                  <p className="text-sm font-medium text-neutral-800">Sub-issues created!</p>
                </div>
              )}
            </div>

            {step === "review" && (
              <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3">
                <span className="text-xs text-neutral-400">{selected.size} of {drafts.length} selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setOpen(false); setStep("idle"); }}
                    className="rounded-lg border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending || selected.size === 0}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Creating…" : `Create ${selected.size} sub-issue${selected.size !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
