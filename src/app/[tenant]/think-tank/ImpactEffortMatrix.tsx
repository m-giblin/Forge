"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { IdeaSummary } from "@/lib/repositories/ideas";
import { updateIdeaScoresAction } from "./actions";

const STATUS_COLOR: Record<string, string> = {
  new:         "bg-neutral-100 border-neutral-300 text-neutral-700",
  researching: "bg-blue-50 border-blue-300 text-blue-800",
  maturing:    "bg-yellow-50 border-yellow-300 text-yellow-800",
  ready:       "bg-green-50 border-green-300 text-green-800",
  converted:   "bg-purple-50 border-purple-300 text-purple-800",
  archived:    "bg-neutral-50 border-neutral-200 text-neutral-400",
};

const QUADRANTS = [
  {
    key: "quick-wins",
    label: "Quick Wins",
    sub: "High impact · Low effort",
    emoji: "⚡",
    bg: "bg-green-50",
    border: "border-green-200",
    header: "text-green-800",
    // impact >= 3, effort <= 3
    test: (impact: number, effort: number) => impact >= 3 && effort <= 3,
    gridArea: "quick-wins",
  },
  {
    key: "big-bets",
    label: "Big Bets",
    sub: "High impact · High effort",
    emoji: "🚀",
    bg: "bg-blue-50",
    border: "border-blue-200",
    header: "text-blue-800",
    test: (impact: number, effort: number) => impact >= 3 && effort > 3,
    gridArea: "big-bets",
  },
  {
    key: "fill-ins",
    label: "Fill-ins",
    sub: "Low impact · Low effort",
    emoji: "📋",
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    header: "text-neutral-600",
    test: (impact: number, effort: number) => impact < 3 && effort <= 3,
    gridArea: "fill-ins",
  },
  {
    key: "money-pits",
    label: "Money Pits",
    sub: "Low impact · High effort",
    emoji: "⚠️",
    bg: "bg-red-50",
    border: "border-red-200",
    header: "text-red-700",
    test: (impact: number, effort: number) => impact < 3 && effort > 3,
    gridArea: "money-pits",
  },
];

interface ScoreEditorProps {
  slug: string;
  idea: IdeaSummary;
  onSave: (id: string, impact: number | null, effort: number | null) => void;
  onClose: () => void;
}

function ScoreEditor({ slug, idea, onSave, onClose }: ScoreEditorProps) {
  const [impact, setImpact] = useState(idea.impact_score ?? 3);
  const [effort, setEffort] = useState(idea.effort_score ?? 3);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateIdeaScoresAction(slug, idea.id, impact, effort);
      onSave(idea.id, impact, effort);
      onClose();
    });
  }

  function clear() {
    startTransition(async () => {
      await updateIdeaScoresAction(slug, idea.id, null, null);
      onSave(idea.id, null, null);
      onClose();
    });
  }

  return (
    <div className="absolute z-50 w-72 rounded-xl border border-neutral-200 bg-white shadow-xl p-4 top-full left-0 mt-1">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Set scores for</p>
      <p className="text-sm font-medium text-neutral-900 mb-4 line-clamp-2">{idea.title}</p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-neutral-600">Impact</label>
            <span className="text-xs font-bold text-neutral-800">{impact} / 5</span>
          </div>
          <input
            type="range" min={1} max={5} step={1} value={impact}
            onChange={(e) => setImpact(Number(e.target.value))}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
            <span>Minimal</span><span>Transformative</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-neutral-600">Effort</label>
            <span className="text-xs font-bold text-neutral-800">{effort} / 5</span>
          </div>
          <input
            type="range" min={1} max={5} step={1} value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
            className="w-full accent-red-400"
          />
          <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
            <span>Trivial</span><span>Massive</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={save}
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save scores"}
        </button>
        {(idea.impact_score !== null || idea.effort_score !== null) && (
          <button
            onClick={clear}
            disabled={isPending}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface IdeaChipProps {
  slug: string;
  idea: IdeaSummary;
  onUpdate: (id: string, impact: number | null, effort: number | null) => void;
}

function IdeaChip({ slug, idea, onUpdate }: IdeaChipProps) {
  const [editing, setEditing] = useState(false);
  const colorClass = STATUS_COLOR[idea.status] ?? STATUS_COLOR.new;

  return (
    <div className="relative">
      <div
        className={`group flex items-start gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer hover:shadow-sm transition-shadow ${colorClass}`}
        onClick={() => setEditing(true)}
      >
        <span className="text-xs font-medium truncate max-w-[160px]">{idea.title}</span>
        <span className="opacity-0 group-hover:opacity-100 text-[10px] ml-auto shrink-0">✏️</span>
      </div>
      {editing && (
        <ScoreEditor
          slug={slug}
          idea={idea}
          onSave={onUpdate}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

interface Props {
  slug: string;
  ideas: IdeaSummary[];
}

export default function ImpactEffortMatrix({ slug, ideas: initialIdeas }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas);

  function handleUpdate(id: string, impact: number | null, effort: number | null) {
    setIdeas((prev) =>
      prev.map((i) => i.id === id ? { ...i, impact_score: impact, effort_score: effort } : i)
    );
  }

  const scored = ideas.filter((i) => i.impact_score !== null && i.effort_score !== null);
  const unscored = ideas.filter((i) => i.impact_score === null || i.effort_score === null);

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span>Click any idea chip to set its scores.</span>
        <span className="ml-auto font-medium text-neutral-700">{scored.length} / {ideas.length} scored</span>
      </div>

      {/* 2×2 Matrix */}
      <div className="grid grid-cols-2 gap-3">
        {/* Axis labels */}
        <div className="col-span-2 flex items-center justify-center gap-2 text-xs text-neutral-400 -mb-1">
          <span className="font-medium">← Less Effort</span>
          <div className="flex-1 h-px bg-neutral-200" />
          <span className="font-medium">More Effort →</span>
        </div>

        {QUADRANTS.map((q) => {
          const qIdeas = scored.filter((i) => q.test(i.impact_score!, i.effort_score!));
          return (
            <div
              key={q.key}
              className={`rounded-xl border-2 p-4 min-h-[180px] ${q.bg} ${q.border}`}
            >
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-lg">{q.emoji}</span>
                <div>
                  <p className={`text-sm font-bold ${q.header}`}>{q.label}</p>
                  <p className="text-[10px] text-neutral-500">{q.sub}</p>
                </div>
                {qIdeas.length > 0 && (
                  <span className="ml-auto text-xs font-semibold text-neutral-400">{qIdeas.length}</span>
                )}
              </div>
              <div className="space-y-1.5">
                {qIdeas.length === 0 && (
                  <p className="text-xs text-neutral-400 italic">No ideas yet</p>
                )}
                {qIdeas.map((idea) => (
                  <IdeaChip key={idea.id} slug={slug} idea={idea} onUpdate={handleUpdate} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscored ideas */}
      {unscored.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Unscored ({unscored.length}) — click to place on matrix
          </p>
          <div className="flex flex-wrap gap-2">
            {unscored.map((idea) => (
              <div key={idea.id} className="relative">
                <IdeaChip slug={slug} idea={idea} onUpdate={handleUpdate} />
              </div>
            ))}
          </div>
        </div>
      )}

      {ideas.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <p className="text-4xl mb-2">💡</p>
          <p className="text-sm">No ideas to display. Create some ideas first.</p>
        </div>
      )}

      {/* Quick link to list view */}
      <div className="text-xs text-neutral-400 flex items-center gap-1.5">
        <span>Idea titles link to the detail page.</span>
        <Link href={`/${slug}/think-tank`} className="text-indigo-500 hover:underline">Back to list view</Link>
      </div>
    </div>
  );
}
