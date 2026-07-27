"use client";

import { Icon } from "./IssueDetailUI";
import type { FieldOption } from "@/lib/repositories/fieldConfig";

export default function IssueStatusPipeline({
  orderedStatuses,
  statusIdx,
  statusPrev,
  statusNext,
  readOnly,
  pending,
  onMoveStatus,
}: {
  orderedStatuses: FieldOption[];
  statusIdx: number;
  statusPrev: FieldOption | undefined;
  statusNext: FieldOption | undefined;
  readOnly: boolean;
  pending: boolean;
  onMoveStatus: (key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      {/* Track */}
      <div className="relative">
        {/* Full grey rail */}
        <div className="absolute left-0 right-0 top-[13px] h-[2px] bg-neutral-200" />
        {/* Blue fill up to current node */}
        {statusIdx > 0 && (
          <div
            className="absolute left-0 top-[13px] h-[2px] bg-blue-500 transition-all duration-300"
            style={{ width: `${(statusIdx / (orderedStatuses.length - 1)) * 100}%` }}
          />
        )}

        {/* Nodes row */}
        <div className="relative flex justify-between">
          {orderedStatuses.map((s, i) => {
            const isDone    = i < statusIdx;
            const isCurrent = i === statusIdx;
            const isJumpable = !readOnly && !pending && !isCurrent;

            return (
              <div key={s.key} className="flex flex-col items-center">
                {/* Node button */}
                <button
                  type="button"
                  disabled={!isJumpable}
                  onClick={() => isJumpable && onMoveStatus(s.key)}
                  title={isJumpable ? `Jump to ${s.label}` : s.label}
                  className={[
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                    isCurrent
                      ? "border-blue-600 bg-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.15)] cursor-default"
                      : isDone
                      ? "border-blue-500 bg-blue-500 hover:scale-110 cursor-pointer"
                      : isJumpable
                      ? "border-neutral-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                      : "border-neutral-200 bg-neutral-50 cursor-default",
                  ].join(" ")}
                >
                  {isDone ? (
                    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-neutral-300" />
                  )}
                </button>

                {/* Label */}
                <span className={[
                  "mt-2.5 max-w-[72px] text-center text-[11px] font-semibold leading-tight tracking-wide",
                  isCurrent ? "text-blue-700" : isDone ? "text-blue-500" : "text-neutral-400",
                ].join(" ")}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advance / revert row */}
      {!readOnly && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={!statusPrev || pending}
            onClick={() => statusPrev && onMoveStatus(statusPrev.key)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-35 transition"
          >
            <Icon name="arrowLeft" size={12} />
            Revert to {statusPrev?.label ?? "…"}
          </button>
          <button
            type="button"
            disabled={!statusNext || pending}
            onClick={() => statusNext && onMoveStatus(statusNext.key)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35 transition shadow-sm"
          >
            Move to {statusNext?.label ?? "…"}
            <Icon name="arrowRight" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
