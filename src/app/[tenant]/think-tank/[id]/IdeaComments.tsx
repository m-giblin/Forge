"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addIdeaCommentAction,
  editIdeaCommentAction,
  deleteIdeaCommentAction,
} from "../actions";
import type { IdeaComment } from "@/lib/repositories/ideas";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function avatar(name: string | null) {
  return (name ?? "?")[0].toUpperCase();
}

interface CardProps {
  comment: IdeaComment;
  slug: string;
  ideaId: string;
  currentUserId: string;
  isAdmin: boolean;
  isReply: boolean;
  onRefresh: () => void;
  children?: React.ReactNode;
}

function CommentCard({
  comment,
  slug,
  ideaId,
  currentUserId,
  isAdmin,
  isReply,
  onRefresh,
  children,
}: CardProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mountedAt] = useState(() => Date.now());

  const isOwn = comment.authorId === currentUserId;
  const withinWindow = mountedAt - new Date(comment.createdAt).getTime() < EDIT_WINDOW_MS;
  const canEdit = !comment.isDeleted && (isAdmin || (isOwn && withinWindow));
  const canDelete = !comment.isDeleted && (isOwn || isAdmin);

  function handleReply() {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await addIdeaCommentAction(slug, ideaId, trimmed, comment.id);
        setReplyBody("");
        setShowReply(false);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post reply.");
      }
    });
  }

  function handleEdit() {
    setError(null);
    startTransition(async () => {
      try {
        await editIdeaCommentAction(slug, comment.id, editBody);
        setEditing(false);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteIdeaCommentAction(slug, comment.id);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  const avatarSize = isReply ? "h-6 w-6 text-xs" : "h-7 w-7 text-xs";

  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600`}
      >
        {avatar(comment.authorName)}
      </div>
      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">
            {comment.authorName ?? "Unknown"}
          </span>
          <span>{relTime(comment.createdAt)}</span>
          {!comment.isDeleted && !editing && (
            <div className="ml-auto flex items-center gap-3">
              {canEdit && (
                <button
                  onClick={() => { setEditing(true); setEditBody(comment.body); }}
                  className="hover:text-neutral-700"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {comment.isDeleted ? (
          <p className="mt-1 text-sm italic text-neutral-400">[comment deleted]</p>
        ) : editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                disabled={isPending || !editBody.trim()}
                className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setError(null); }}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
            {comment.body}
          </p>
        )}

        {error && !editing && <p className="mt-1 text-xs text-red-600">{error}</p>}

        {/* Reply button — only on top-level comments */}
        {!isReply && !comment.isDeleted && !editing && (
          <button
            onClick={() => setShowReply((v) => !v)}
            className="mt-1 text-xs text-neutral-400 hover:text-neutral-600"
          >
            {showReply ? "Cancel" : "Reply"}
          </button>
        )}

        {/* Inline reply form */}
        {showReply && (
          <div className="mt-2 space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              autoFocus
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleReply}
                disabled={isPending || !replyBody.trim()}
                className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {isPending ? "Posting…" : "Post reply"}
              </button>
              <button
                onClick={() => { setShowReply(false); setReplyBody(""); }}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {children && (
          <div className="mt-3 space-y-3 border-l-2 border-neutral-100 pl-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  slug: string;
  ideaId: string;
  currentUserId: string;
  isAdmin: boolean;
  initialComments: IdeaComment[];
}

export default function IdeaComments({
  slug,
  ideaId,
  currentUserId,
  isAdmin,
  initialComments,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const topLevel = initialComments.filter((c) => c.parentId === null);
  const repliesMap = new Map<string, IdeaComment[]>();
  for (const c of initialComments) {
    if (c.parentId) {
      const arr = repliesMap.get(c.parentId) ?? [];
      arr.push(c);
      repliesMap.set(c.parentId, arr);
    }
  }

  function refresh() {
    router.refresh();
  }

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await addIdeaCommentAction(slug, ideaId, trimmed, null);
        setBody("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post comment.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-medium text-neutral-700">💬 Discussion</p>

      {topLevel.length === 0 ? (
        <p className="mb-4 text-sm italic text-neutral-400">
          No comments yet. Start the discussion.
        </p>
      ) : (
        <div className="mb-5 space-y-5">
          {topLevel.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              slug={slug}
              ideaId={ideaId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isReply={false}
              onRefresh={refresh}
            >
              {(repliesMap.get(comment.id) ?? []).map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  slug={slug}
                  ideaId={ideaId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  isReply={true}
                  onRefresh={refresh}
                />
              ))}
            </CommentCard>
          ))}
        </div>
      )}

      {/* New top-level comment form */}
      <div className={topLevel.length > 0 ? "border-t border-neutral-100 pt-4" : ""}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a comment…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isPending || !body.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isPending ? "Posting…" : "Post comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
