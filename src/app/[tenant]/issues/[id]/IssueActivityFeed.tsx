"use client";

import { useState } from "react";
import { relTime, avatarColor, avatarInitials } from "./IssueDetailUI";
import type { IssueComment, IssueEvent } from "@/lib/repositories/issueActivity";

type TimelineItem =
  | { kind: "comment"; data: IssueComment }
  | { kind: "event"; data: IssueEvent };

export default function IssueActivityFeed({
  comments,
  timeline,
  repliesByParent,
  readOnly,
  timerPending,
  sharedTimerAt,
  onInlineStart,
  onInlineStop,
  inlineTimerError,
  canMarkDecision,
  commentType,
  setCommentType,
  commentBody,
  setCommentBody,
  postComment,
  commenting,
  replyToId,
  replyToLabel,
  startReply,
  cancelReply,
  eventValue,
}: {
  comments: IssueComment[];
  timeline: TimelineItem[];
  repliesByParent: Map<string, IssueComment[]>;
  readOnly: boolean;
  timerPending: boolean;
  sharedTimerAt: string | null;
  onInlineStart: () => void;
  onInlineStop: () => void;
  inlineTimerError: string | null;
  canMarkDecision: boolean;
  commentType: "comment" | "decision";
  setCommentType: (t: "comment" | "decision") => void;
  commentBody: string;
  setCommentBody: (v: string) => void;
  postComment: () => void;
  commenting: boolean;
  replyToId: string | null;
  replyToLabel: string | null;
  startReply: (commentId: string, authorLabel: string | null) => void;
  cancelReply: () => void;
  eventValue: (field: string, raw: string | null) => string;
}) {
  const [tab, setTab] = useState<"comments" | "updates">("comments");
  const eventItems = timeline.filter((t) => t.kind === "event");
  const visibleItems = tab === "comments" ? timeline.filter((t) => t.kind === "comment") : eventItems;

  return (
    <div className="bg-[#f4f2eb] rounded-xl border border-[#ddd8c9] p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex rounded-lg border border-[#ddd8c9] bg-[#faf8f2] p-0.5 w-fit gap-0.5">
          <button
            type="button"
            onClick={() => setTab("comments")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${tab === "comments" ? "bg-[#20201d] text-white" : "text-[#726e60] hover:text-[#4a473e]"}`}
          >
            Comments{comments.length > 0 && ` (${comments.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab("updates")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${tab === "updates" ? "bg-[#20201d] text-white" : "text-[#726e60] hover:text-[#4a473e]"}`}
          >
            Updates{eventItems.length > 0 && ` (${eventItems.length})`}
          </button>
        </div>
        <div className="flex-1" />
        {!readOnly && (
          <button
            type="button"
            disabled={timerPending}
            onClick={sharedTimerAt ? onInlineStop : onInlineStart}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
              sharedTimerAt
                ? "bg-[#fdf1de] text-[#c9791d] hover:bg-[#fbe6c2] border border-[#c9791d]/30"
                : "bg-[#fbeae8] text-[#b7452f] hover:bg-[#f6d9d4] border border-[#b7452f]/30"
            }`}
          >
            {sharedTimerAt ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-[#c9791d] animate-pulse" />⏹ Stop Timer</>
            ) : (
              <>▶ Start Timer</>
            )}
          </button>
        )}
      </div>
      {inlineTimerError && (
        <p className="mb-2 text-xs text-[#c0392b] bg-[#fbeae8] rounded px-2 py-1">{inlineTimerError}</p>
      )}

      <div className="space-y-3">
        {visibleItems.length === 0 && (
          <p className="text-xs text-[#726e60]">{tab === "comments" ? "No comments yet." : "No status/field changes yet."}</p>
        )}

        {visibleItems.map((item) => {
          if (item.kind === "event") {
            const e = item.data;
            return (
              <div key={e.id} className="flex items-start gap-2.5 text-xs text-[#726e60]">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[#e5e1d3] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#726e60]">⚙</span>
                </div>
                <div className="pt-0.5">
                  <span className="font-medium text-[#4a473e]">{e.actorLabel ?? "Someone"}</span>{" "}
                  {e.field === "details" ? "edited the details" : (
                    <>changed <span className="font-medium text-[#4a473e]">{e.field}</span> from{" "}
                    <span className="text-[#4a473e]">{eventValue(e.field, e.oldValue)}</span> to{" "}
                    <span className="font-medium text-[#4a473e]">{eventValue(e.field, e.newValue)}</span></>
                  )}{" "}
                  <span title={new Date(e.createdAt).toLocaleString()} className="text-[#a19d90]">· {relTime(e.createdAt)}</span>
                </div>
              </div>
            );
          }

          const c = item.data;
          const replies = repliesByParent.get(c.id) ?? [];
          return (
            <div key={c.id}>
              {/* Top-level comment */}
              <div className={`rounded-lg border p-3.5 ${c.commentType === "decision" ? "border-[#c9791d]/40 bg-[#fdf1de]" : "border-[#ddd8c9] bg-[#faf8f2]"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(c.authorLabel)}`}>
                    {avatarInitials(c.authorLabel)}
                  </div>
                  <span className="text-xs font-semibold text-[#4a473e]">{c.authorLabel ?? "Someone"}</span>
                  <span className="text-xs text-[#a19d90]" title={new Date(c.createdAt).toLocaleString()}>· {relTime(c.createdAt)}</span>
                  {c.commentType === "decision" && (
                    <span className="ml-auto rounded-full bg-[#f6d9a8] px-2 py-0.5 text-[10px] font-bold text-[#c9791d]">💡 Decision</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-[#4a473e]">{c.body}</p>
                {!readOnly && (
                  <button
                    onClick={() => startReply(c.id, c.authorLabel)}
                    className="mt-2 text-xs text-[#a19d90] hover:text-[#3a6ea8] transition"
                  >
                    Reply
                  </button>
                )}
              </div>

              {/* Threaded replies */}
              {replies.length > 0 && (
                <div className="ml-6 mt-1.5 space-y-1.5 border-l-2 border-[#ddd8c9] pl-3">
                  {replies.map((r) => (
                    <div key={r.id} className="rounded-lg border border-[#ddd8c9] bg-[#faf8f2] p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <div className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(r.authorLabel)}`}>
                          {avatarInitials(r.authorLabel)}
                        </div>
                        <span className="text-xs font-semibold text-[#4a473e]">{r.authorLabel ?? "Someone"}</span>
                        <span className="text-xs text-[#a19d90]" title={new Date(r.createdAt).toLocaleString()}>· {relTime(r.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-[#4a473e]">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && tab === "comments" && (
        <div className="mt-5">
          {replyToId && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-[#eaf1f8] px-3 py-1.5 text-xs text-[#3a6ea8]">
              <span>Replying to <span className="font-semibold">{replyToLabel ?? "comment"}</span></span>
              <button onClick={cancelReply} className="ml-auto text-[#3a6ea8]/60 hover:text-[#3a6ea8]">✕</button>
            </div>
          )}
          {canMarkDecision && !replyToId && (
            <div className="mb-2 flex rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] p-0.5 w-fit gap-0.5">
              <button
                onClick={() => setCommentType("comment")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${commentType === "comment" ? "bg-[#faf8f2] text-[#20201d] shadow-sm" : "text-[#726e60] hover:text-[#4a473e]"}`}
              >
                Comment
              </button>
              <button
                onClick={() => setCommentType("decision")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${commentType === "decision" ? "bg-[#fdf1de] text-[#c9791d] shadow-sm" : "text-[#726e60] hover:text-[#4a473e]"}`}
              >
                💡 Decision
              </button>
            </div>
          )}
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(); }}
            rows={2}
            placeholder={commentType === "decision" ? "Record an official decision…" : replyToId ? "Write a reply…" : "Add a comment… (Cmd+Enter to post)"}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-1 ${commentType === "decision" ? "border-[#c9791d]/40 bg-[#fdf1de] focus:border-[#c9791d] focus:ring-[#c9791d]/20" : "border-[#ddd8c9] focus:border-[#3a6ea8] focus:ring-[#3a6ea8]/20"}`}
          />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-xs text-[#a19d90]">Cmd+Enter to post</span>
            <button
              onClick={postComment}
              disabled={commenting || !commentBody.trim()}
              className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition disabled:bg-[#ddd8c9] disabled:cursor-not-allowed ${commentType === "decision" ? "bg-[#c9791d] hover:bg-[#a8650f]" : "bg-[#3a6ea8] hover:bg-[#2f5a8a]"}`}
            >
              {commenting ? "Posting…" : replyToId ? "Post reply" : commentType === "decision" ? "Post Decision" : "Post comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
