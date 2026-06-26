"use client";

import { useState, useTransition } from "react";
import { generatePRDAction, type IdeaPRD } from "../actions";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-neutral-800 flex gap-2">
            <span className="text-neutral-400 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function copyPRD(prd: IdeaPRD, title: string) {
  const text = [
    `# PRD: ${title}`,
    "",
    `## Problem Statement\n${prd.problem_statement}`,
    "",
    `## Goals\n${prd.goals.map((g) => `- ${g}`).join("\n")}`,
    "",
    `## Success Metrics\n${prd.success_metrics.map((m) => `- ${m}`).join("\n")}`,
    "",
    `## User Stories\n${prd.user_stories.map((s) => `- ${s}`).join("\n")}`,
    "",
    `## In Scope\n${prd.in_scope.map((s) => `- ${s}`).join("\n")}`,
    "",
    `## Out of Scope\n${prd.out_of_scope.map((s) => `- ${s}`).join("\n")}`,
    "",
    `## Technical Notes\n${prd.technical_notes}`,
    "",
    `## Open Questions\n${prd.open_questions.map((q) => `- ${q}`).join("\n")}`,
    "",
    `## Risks\n${prd.risks.map((r) => `- ${r}`).join("\n")}`,
  ].join("\n");
  navigator.clipboard.writeText(text).catch(() => null);
}

export default function IdeaPRDPanel({
  slug,
  ideaId,
  ideaTitle,
}: {
  slug: string;
  ideaId: string;
  ideaTitle: string;
}) {
  const [prd, setPrd] = useState<IdeaPRD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generatePRDAction(slug, ideaId);
        setPrd(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "PRD generation failed");
      }
    });
  }

  function handleCopy() {
    if (!prd) return;
    copyPRD(prd, ideaTitle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!prd) {
    return (
      <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-800">📄 Draft PRD with AI</p>
            <p className="text-xs text-purple-600 mt-0.5">Generate a full Product Requirements Document from this idea and its discussion.</p>
          </div>
          <button
            onClick={generate}
            disabled={isPending}
            className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                Drafting…
              </span>
            ) : (
              "Draft PRD ✨"
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-purple-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-purple-100 bg-purple-50">
        <p className="text-sm font-semibold text-purple-800">📄 AI-Drafted PRD</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy as Markdown"}
          </button>
          <button
            onClick={generate}
            disabled={isPending}
            className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50"
          >
            {isPending ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            onClick={() => setPrd(null)}
            className="text-xs text-purple-400 hover:text-purple-700"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Problem Statement</p>
          <p className="text-sm text-neutral-800">{prd.problem_statement}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Goals" items={prd.goals} />
          <Section title="Success Metrics" items={prd.success_metrics} />
        </div>

        <Section title="User Stories" items={prd.user_stories} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1.5">✓ In Scope</p>
            <ul className="space-y-1">
              {prd.in_scope.map((item, i) => (
                <li key={i} className="text-sm text-neutral-800 flex gap-2">
                  <span className="text-green-500 shrink-0">+</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1.5">✗ Out of Scope</p>
            <ul className="space-y-1">
              {prd.out_of_scope.map((item, i) => (
                <li key={i} className="text-sm text-neutral-800 flex gap-2">
                  <span className="text-red-400 shrink-0">−</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {prd.technical_notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Technical Notes</p>
            <p className="text-sm text-neutral-700 leading-relaxed">{prd.technical_notes}</p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Open Questions" items={prd.open_questions} />
          <Section title="Risks" items={prd.risks} />
        </div>
      </div>
    </div>
  );
}
