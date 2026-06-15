"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { soundingBoardAction } from "../actions";
import { PILLS } from "@/lib/ai/pills";
import type { IdeaAiTurn } from "@/lib/repositories/ideas";

interface Props {
  slug: string;
  ideaId: string;
  isViewer: boolean;
  lastTurn: IdeaAiTurn | null;
}

export default function SoundingBoard({ slug, ideaId, isViewer, lastTurn }: Props) {
  const [selectedPills, setSelectedPills] = useState<string[]>(lastTurn?.pills ?? []);
  const [userInput, setUserInput] = useState("");
  const [response, setResponse] = useState<string | null>(lastTurn?.aiResponse ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        setResponse(result.text);
        setUserInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const canSubmit = !isViewer && (selectedPills.length > 0 || userInput.trim().length > 0);
  const isRateLimit = error?.toLowerCase().includes("rate limit");

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">🤖 AI Sounding Board</p>
        <span className="text-xs text-neutral-400">Grok · 20 calls/tenant/hr</span>
      </div>

      {isViewer ? (
        <p className="text-sm italic text-neutral-400">
          Viewers cannot use the AI Sounding Board.
        </p>
      ) : (
        <>
          {/* Pill selector */}
          <div className="mb-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Choose your lens
            </p>
            <div className="flex flex-wrap gap-2">
              {PILLS.map((pill) => (
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
            placeholder="Anything specific to focus on? (optional)"
            className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:opacity-50"
          />

          {/* Error */}
          {error && (
            <div
              className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                isRateLimit
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPending ? "Thinking…" : response ? "Ask again" : "Ask AI"}
            </button>
            {isPending && (
              <span className="text-xs text-neutral-400">
                This may take up to 30 seconds…
              </span>
            )}
          </div>
        </>
      )}

      {/* Response */}
      {response && (
        <div className="border-t border-neutral-100 pt-4">
          <div className="prose prose-sm prose-neutral max-w-none text-sm text-neutral-700 [&_h1]:text-base [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-neutral-800 [&_h3]:text-sm [&_h3]:font-medium [&_ul]:pl-4 [&_li]:my-0.5">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            AI responses may be inaccurate. Verify important claims independently.
          </p>
        </div>
      )}
    </div>
  );
}
