"use client";

import { SideGroupLabel, InfoTooltip, sidebarSelect, sideLabel } from "./IssueDetailUI";
import SlaChip from "@/components/SlaChip";
import type { SlaTimer } from "@/lib/services/sla";
import type { IssuePatch } from "@/lib/services/issues";

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];

export default function IssuePlanningPanel({
  startDate,
  dueDate,
  phase,
  storyPoints,
  readOnly,
  slaTimer,
  setStartDate,
  setDueDate,
  setPhase,
  setStoryPoints,
  saveField,
}: {
  startDate: string;
  dueDate: string;
  phase: string;
  storyPoints: string;
  readOnly: boolean;
  slaTimer?: SlaTimer;
  setStartDate: (v: string) => void;
  setDueDate: (v: string) => void;
  setPhase: (v: string) => void;
  setStoryPoints: (v: string) => void;
  saveField: (patch: IssuePatch) => void;
}) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
      <SideGroupLabel color="text-green-600">📅 Planning</SideGroupLabel>
      <div>
        <p className={sideLabel}>Start date</p>
        <input type="date" value={startDate} disabled={readOnly} onChange={(e) => { setStartDate(e.target.value); saveField({ startDate: e.target.value || null }); }} className={sidebarSelect} />
      </div>
      <div>
        <p className={sideLabel}>Due date</p>
        <input type="date" value={dueDate} disabled={readOnly} onChange={(e) => { setDueDate(e.target.value); saveField({ dueDate: e.target.value || null }); }} className={sidebarSelect} />
      </div>
      <div>
        <p className={sideLabel}>Phase</p>
        <select value={phase} disabled={readOnly} onChange={(e) => { setPhase(e.target.value); saveField({ phase: e.target.value || null }); }} className={sidebarSelect}>
          <option value="">— None —</option>
          <option value="discovery">Discovery</option>
          <option value="design">Design</option>
          <option value="development">Development</option>
          <option value="testing">Testing</option>
          <option value="deployment">Deployment</option>
        </select>
      </div>
      <div>
        <p className={sideLabel}>
          Story Points
          <InfoTooltip text="An estimate of effort using the Fibonacci scale. 1 = trivial (under an hour). 3 = small (a day). 5 = medium (2–3 days). 8 = large (a week). 13+ = break it down first." />
        </p>
        <div className="flex items-center gap-1.5">
          {STORY_POINT_OPTIONS.map((pt) => (
            <button
              key={pt}
              disabled={readOnly}
              onClick={() => { const v = storyPoints === String(pt) ? "" : String(pt); setStoryPoints(v); saveField({ storyPoints: v ? Number(v) : null }); }}
              className={`h-7 w-7 rounded-md text-xs font-semibold border transition-colors ${
                storyPoints === String(pt)
                  ? "bg-green-600 border-green-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-green-400 hover:text-green-700"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {pt}
            </button>
          ))}
          <input
            type="number"
            min="1"
            value={storyPoints}
            disabled={readOnly}
            onBlur={(e) => saveField({ storyPoints: e.target.value ? Number(e.target.value) : null })}
            onChange={(e) => setStoryPoints(e.target.value)}
            placeholder="?"
            className="w-10 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-center outline-none focus:border-green-400 disabled:opacity-40"
          />
        </div>
      </div>
      {slaTimer && <SlaChip timer={slaTimer} />}
    </div>
  );
}
