"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { soundingBoardAction } from "../actions";
import { PILLS, type Pill } from "@/lib/ai/pills";
import type { IdeaAiTurn } from "@/lib/repositories/ideas";

interface Props {
  slug: string;
  ideaId: string;
  isViewer: boolean;
  initialTurns: IdeaAiTurn[];
  customPills?: Pill[];
}

const DISCLOSURE_KEY = "tt_ai_disclosure_dismissed";

function PillChips({ pillIds, pillMap }: { pillIds: string[]; pillMap: Map<string, Pill> }) {
  if (pillIds.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {pillIds.map((id) => {
        const pill = pillMap.get(id);
        return pill ? (
          <span key={id} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {pill.label}
          </span>
        ) : null;
      })}
    </div>
  );
}

export default function SoundingBoard({ slug, ideaId, isViewer, initialTurns, customPills = [] }: Props) {
  // Merged pill list: defaults + tenant custom additions
  const allPills: Pill[] = [...PILLS, ...customPills];
  const allPillMap = new Map<string, Pill>(allPills.map((p) => [p.id, p]));
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [turns, setTurns] = useState<IdeaAiTurn[]>(initialTurns);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [disclosureDismissed, setDisclosureDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(DISCLOSURE_KEY) === "1") {
      startTransition(() => setDisclosureDismissed(true));
    }
  }, []);

  // Scroll to newest turn after it's added.
  useEffect(() => {
    if (turns.length > initialTurns.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns.length, initialTurns.length]);

  function dismissDisclosure() {
    localStorage.setItem(DISCLOSURE_KEY, "1");
    setDisclosureDismissed(true);
  }

  function togglePill(id: string) {
    setSelectedPills((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await soundingBoardAction(slug, ideaId, selectedPills, userInput);
        // Append new turn to the thread (optimistic — server already saved it).
        const newTurn: IdeaAiTurn = {
          id: crypto.randomUUID(),
          ideaId,
          userId: null,
          pills: selectedPills,
          userInput: userInput.trim() || null,
          aiResponse: result.text,
          provider: "grok",
          createdAt: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, newTurn]);
        setUserInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const canSubmit = !isViewer && (selectedPills.length > 0 || userInput.trim().length > 0);
  const isRateLimit = error?.toLowerCase().includes("rate limit");
  const hasTurns = turns.length > 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <p className="text-sm font-medium text-neutral-700">🤖 AI Sounding Board</p>
        <span className="text-xs text-neutral-400">Grok · 20 calls/tenant/hr</span>
      </div>

      {isViewer ? (
        <p className="px-5 py-4 text-sm italic text-neutral-400">
          Viewers cannot use the AI Sounding Board.
        </p>
      ) : (
        <>
          {/* Conversation thread */}
          {hasTurns && (
            <div className="divide-y divide-neutral-100">
              {turns.map((turn, i) => (
                <div key={turn.id} className="px-5 py-4">
                  {/* Turn header */}
                  <div className="mb-2 flex items-center justify-between">
                    <PillChips pillIds={turn.pills} pillMap={allPillMap} />
                    <span className="shrink-0 text-xs text-neutral-400">
                      Turn {i + 1}
                    </span>
                  </div>
                  {/* User question */}
                  {turn.userInput && (
                    <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600 italic">
                      &ldquo;{turn.userInput}&rdquo;
                    </p>
                  )}
                  {/* AI response */}
                  <div className="prose prose-sm prose-neutral max-w-none text-sm text-neutral-700 [&_h1]:text-base [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-neutral-800 [&_h3]:text-sm [&_h3]:font-medium [&_ul]:pl-4 [&_li]:my-0.5">
                    <ReactMarkdown>{turn.aiResponse}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={bottomRef} />

          {/* Input area */}
          <div className="border-t border-neutral-100 px-5 py-4">
            {/* Data residency disclosure */}
            {!disclosureDismissed && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <span className="mt-0.5 shrink-0">⚠️</span>
                <span className="flex-1">
                  Your idea content will be sent to <strong>Grok (xAI)</strong> for analysis. Do not include information you are not authorized to share externally.
                </span>
                <button
                  onClick={dismissDisclosure}
                  className="shrink-0 font-medium underline hover:no-underline"
                >
                  Got it
                </button>
              </div>
            )}

            {/* Pill selector */}
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                {hasTurns ? "Follow-up lens" : "Choose your lens"}
              </p>
              <div className="flex flex-wrap gap-2">
                {allPills.map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => togglePill(pill.id)}
                    disabled={isPending}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                      selectedPills.includes(pill.id)
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional question */}
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder={hasTurns ? "Follow-up question… (optional)" : "Anything specific to focus on? (optional)"}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:opacity-50"
            />

            {/* Error */}
            {error && (
              <div
                className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                  isRateLimit ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {isPending ? "Thinking…" : hasTurns ? "Send follow-up" : "Ask AI"}
              </button>
              {isPending && (
                <span className="text-xs text-neutral-400">This may take up to 30 seconds…</span>
              )}
              {hasTurns && !isPending && (
                <span className="text-xs text-neutral-400">
                  {turns.length} turn{turns.length !== 1 ? "s" : ""} · AI has full context
                </span>
              )}
            </div>
          </div>

          {/* Footer disclaimer */}
          {hasTurns && (
            <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
              AI responses may be inaccurate. Verify important claims independently.
            </p>
          )}
        </>
      )}
    </div>
  );
}
