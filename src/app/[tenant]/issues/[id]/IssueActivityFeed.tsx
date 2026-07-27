"use client";

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
  return (
    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600 flex-1">
          Activity
          {comments.length > 0 && (
            <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-neutral-600">{comments.length}</span>
          )}
        </p>
        {!readOnly && (
          <button
            type="button"
            disabled={timerPending}
            onClick={sharedTimerAt ? onInlineStop : onInlineStart}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
              sharedTimerAt
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
            }`}
          >
            {sharedTimerAt ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />⏹ Stop Timer</>
            ) : (
              <>▶ Start Timer</>
            )}
          </button>
        )}
      </div>
      {inlineTimerError && (
        <p className="mb-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{inlineTimerError}</p>
      )}

      <div className="space-y-3">
        {timeline.length === 0 && (
          <p className="text-xs text-neutral-500">No activity yet.</p>
        )}

        {timeline.map((item) => {
          if (item.kind === "event") {
            const e = item.data;
            return (
              <div key={e.id} className="flex items-start gap-2.5 text-xs text-neutral-500">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-neutral-200 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-neutral-500">⚙</span>
                </div>
                <div className="pt-0.5">
                  <span className="font-medium text-neutral-700">{e.actorLabel ?? "Someone"}</span>{" "}
                  {e.field === "details" ? "edited the details" : (
                    <>changed <span className="font-medium text-neutral-700">{e.field}</span> from{" "}
                    <span className="text-neutral-700">{eventValue(e.field, e.oldValue)}</span> to{" "}
                    <span className="font-medium text-neutral-700">{eventValue(e.field, e.newValue)}</span></>
                  )}{" "}
                  <span title={new Date(e.createdAt).toLocaleString()} className="text-neutral-400">· {relTime(e.createdAt)}</span>
                </div>
              </div>
            );
          }

          const c = item.data;
          const replies = repliesByParent.get(c.id) ?? [];
          return (
            <div key={c.id}>
              {/* Top-level comment */}
              <div className={`rounded-lg border p-3.5 ${c.commentType === "decision" ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(c.authorLabel)}`}>
                    {avatarInitials(c.authorLabel)}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800">{c.authorLabel ?? "Someone"}</span>
                  <span className="text-xs text-neutral-400" title={new Date(c.createdAt).toLocaleString()}>· {relTime(c.createdAt)}</span>
                  {c.commentType === "decision" && (
                    <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">💡 Decision</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{c.body}</p>
                {!readOnly && (
                  <button
                    onClick={() => startReply(c.id, c.authorLabel)}
                    className="mt-2 text-xs text-neutral-400 hover:text-blue-600 transition"
                  >
                    Reply
                  </button>
                )}
              </div>

              {/* Threaded replies */}
              {replies.length > 0 && (
                <div className="ml-6 mt-1.5 space-y-1.5 border-l-2 border-neutral-200 pl-3">
                  {replies.map((r) => (
                    <div key={r.id} className="rounded-lg border border-neutral-100 bg-white p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <div className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(r.authorLabel)}`}>
                          {avatarInitials(r.authorLabel)}
                        </div>
                        <span className="text-xs font-semibold text-neutral-800">{r.authorLabel ?? "Someone"}</span>
                        <span className="text-xs text-neutral-400" title={new Date(r.createdAt).toLocaleString()}>· {relTime(r.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-neutral-700">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-5">
          {replyToId && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
              <span>Replying to <span className="font-semibold">{replyToLabel ?? "comment"}</span></span>
              <button onClick={cancelReply} className="ml-auto text-blue-400 hover:text-blue-700">✕</button>
            </div>
          )}
          {canMarkDecision && !replyToId && (
            <div className="mb-2 flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 w-fit gap-0.5">
              <button
                onClick={() => setCommentType("comment")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${commentType === "comment" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
              >
                Comment
              </button>
              <button
                onClick={() => setCommentType("decision")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${commentType === "decision" ? "bg-amber-100 text-amber-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-1 ${commentType === "decision" ? "border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100" : "border-neutral-200 focus:border-blue-400 focus:ring-blue-100"}`}
          />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Cmd+Enter to post</span>
            <button
              onClick={postComment}
              disabled={commenting || !commentBody.trim()}
              className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition disabled:bg-neutral-300 disabled:cursor-not-allowed ${commentType === "decision" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {commenting ? "Posting…" : replyToId ? "Post reply" : commentType === "decision" ? "Post Decision" : "Post comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
