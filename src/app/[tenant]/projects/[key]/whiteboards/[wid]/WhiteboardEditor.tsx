"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, useEditor, type Editor, type TLEditorSnapshot, type TLShapeId } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import IssueSearchModal from "./IssueSearchModal";

interface LinkedIssue {
  id: string;
  key: string;
  title: string;
  status: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  todo:        { bg: "#e5e7eb", text: "#374151" },
  in_progress: { bg: "#dbeafe", text: "#1d4ed8" },
  in_review:   { bg: "#fef3c7", text: "#b45309" },
  done:        { bg: "#d1fae5", text: "#065f46" },
  backlog:     { bg: "#f3f4f6", text: "#6b7280" },
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done", backlog: "Backlog",
};

// ── Badge overlay — renders on top of the tldraw canvas ──────────────────────
function IssueBadgesOverlay({
  linkedIssues,
  onBadgeClick,
}: {
  linkedIssues: Record<string, LinkedIssue>;
  onBadgeClick: (issue: LinkedIssue) => void;
}) {
  const editor = useEditor();
  const [, forceRender] = useState(0);

  // Re-render whenever camera or shapes change so badges track correctly
  useEffect(() => {
    const unsub = editor.store.listen(() => forceRender((n) => n + 1), { scope: "all" });
    return unsub;
  }, [editor]);

  return (
    <>
      {Object.entries(linkedIssues).map(([shapeId, issue]) => {
        const bounds = editor.getShapePageBounds(shapeId as TLShapeId);
        if (!bounds) return null;

        // Convert page coords → screen coords
        const topRight = editor.pageToScreen({ x: bounds.maxX, y: bounds.minY });
        const colors = STATUS_COLORS[issue.status] ?? STATUS_COLORS.backlog;

        return (
          <div
            key={shapeId}
            style={{
              position: "absolute",
              left: topRight.x - 4,
              top: topRight.y - 4,
              transform: "translate(-100%, 0)",
              zIndex: 100,
              pointerEvents: "all",
            }}
          >
            <button
              onClick={() => onBadgeClick(issue)}
              title={issue.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.text}30`,
                borderRadius: 6,
                padding: "2px 6px",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "monospace",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
              }}
            >
              {issue.key}
              <span style={{
                fontSize: 10,
                fontWeight: 500,
                fontFamily: "sans-serif",
                opacity: 0.85,
              }}>
                {STATUS_LABELS[issue.status] ?? issue.status}
              </span>
            </button>
          </div>
        );
      })}
    </>
  );
}

// ── Issue detail flyout ───────────────────────────────────────────────────────
function IssueFlyout({ issue, slug, projectKey, onClose }: {
  issue: LinkedIssue;
  slug: string;
  projectKey: string;
  onClose: () => void;
}) {
  const colors = STATUS_COLORS[issue.status] ?? STATUS_COLORS.backlog;
  return (
    <div className="absolute bottom-4 right-4 z-[9999] w-72 rounded-xl border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
        <span className="font-mono text-xs text-neutral-500">{issue.key}</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-sm">✕</button>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-neutral-900 leading-snug">{issue.title}</p>
        <span style={{ background: colors.bg, color: colors.text }}
          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium">
          {STATUS_LABELS[issue.status] ?? issue.status}
        </span>
      </div>
      <div className="border-t border-neutral-100 px-4 py-2.5">
        <Link
          href={`/${slug}/projects/${projectKey}/issues/${issue.id}`}
          className="text-xs text-blue-600 hover:underline"
          target="_blank"
        >
          Open issue →
        </Link>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
interface Props {
  slug: string;
  projectId: string;
  projectKey: string;
  whiteboard: {
    id: string;
    name: string;
    state: Record<string, unknown> | null;
  };
  canEdit: boolean;
}

export default function WhiteboardEditor({ slug, projectId, projectKey, whiteboard, canEdit }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(whiteboard.name);
  const [editingName, setEditingName] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Issue linking state
  const [linkedIssues, setLinkedIssues] = useState<Record<string, LinkedIssue>>({});
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [flyoutIssue, setFlyoutIssue] = useState<LinkedIssue | null>(null);

  const apiBase = `/api/projects/${projectId}/whiteboards/${whiteboard.id}?slug=${slug}`;

  // ── Scan shapes for linked issues and fetch their current status ──────────
  const refreshLinkedIssues = useCallback(async (editor: Editor) => {
    const allShapes = editor.getCurrentPageShapes();
    const withLinks = allShapes.filter((s) => s.meta?.issueId);
    if (withLinks.length === 0) { setLinkedIssues({}); return; }

    const issueIds = [...new Set(withLinks.map((s) => s.meta.issueId as string))];
    try {
      const res = await fetch(`/api/v1/issues?project=${projectKey}&limit=200`);
      const json = await res.json();
      const byId: Record<string, LinkedIssue> = {};
      for (const i of (json.data ?? [])) {
        if (issueIds.includes(i.id)) {
          byId[i.id] = { id: i.id, key: i.key, title: i.title, status: i.status };
        }
      }
      const shapeMap: Record<string, LinkedIssue> = {};
      for (const shape of withLinks) {
        const issue = byId[shape.meta.issueId as string];
        if (issue) shapeMap[shape.id] = issue;
      }
      setLinkedIssues(shapeMap);
    } catch { /* silent */ }
  }, [projectKey]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!editorRef.current || !canEdit) return;
    setSaving(true);
    try {
      const snapshot = editorRef.current.getSnapshot();
      await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: snapshot }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [apiBase, canEdit]);

  const scheduleAutoSave = useCallback(() => {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 3000);
  }, [canEdit, save]);

  async function saveName(newName: string) {
    const trimmed = newName.trim() || whiteboard.name;
    setName(trimmed);
    setEditingName(false);
    await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
  }

  // ── Link an issue to the selected shape ───────────────────────────────────
  function handleLinkIssue() {
    if (!editorRef.current) return;
    const selected = [...editorRef.current.getSelectedShapeIds()];
    if (selected.length !== 1) return;
    setSelectedShapeId(selected[0]);
    setShowLinkModal(true);
  }

  function handleIssueSelected(issue: LinkedIssue) {
    if (!editorRef.current || !selectedShapeId) return;
    // Store in shape meta — persists with the tldraw snapshot
    editorRef.current.updateShapes([{
      id: selectedShapeId as TLShapeId,
      type: editorRef.current.getShape(selectedShapeId as TLShapeId)!.type,
      meta: { issueId: issue.id },
    }]);
    setLinkedIssues((prev) => ({ ...prev, [selectedShapeId]: issue }));
    setShowLinkModal(false);
    setSelectedShapeId(null);
    scheduleAutoSave();
  }

  function handleUnlinkShape() {
    if (!editorRef.current) return;
    const selected = [...editorRef.current.getSelectedShapeIds()];
    if (selected.length !== 1) return;
    const shapeId = selected[0];
    const shape = editorRef.current.getShape(shapeId);
    if (!shape) return;
    editorRef.current.updateShapes([{ id: shapeId, type: shape.type, meta: { issueId: undefined } }]);
    setLinkedIssues((prev) => { const n = { ...prev }; delete n[shapeId]; return n; });
    scheduleAutoSave();
  }

  // AI clustering state
  const [clustering, setClustering] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

  async function handleClusterStickies() {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selected = [...editor.getSelectedShapeIds()];
    const stickies = selected
      .map((id) => editor.getShape(id))
      .filter((s) => s?.type === "note")
      .map((s) => ({ id: s!.id, text: (s!.props as { text?: string }).text ?? "" }));

    if (stickies.length < 2) {
      setClusterError("Select at least 2 sticky notes");
      setTimeout(() => setClusterError(null), 3000);
      return;
    }

    setClustering(true);
    setClusterError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/whiteboards/cluster?slug=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickies }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Clustering failed");

      const groups: Array<{ name: string; stickyIds: string[] }> = json.groups;

      // Create a frame for each group that wraps its stickies
      for (const group of groups) {
          const groupShapes = group.stickyIds
            .map((id) => editor.getShape(id as TLShapeId))
            .filter(Boolean);
          if (groupShapes.length === 0) continue;

          // Compute bounding box of the group
          const xs = groupShapes.flatMap((s) => [s!.x, s!.x + 160]);
          const ys = groupShapes.flatMap((s) => [s!.y, s!.y + 160]);
          const pad = 24;
          const x = Math.min(...xs) - pad;
          const y = Math.min(...ys) - pad - 32; // extra top for label
          const w = Math.max(...xs) - x + pad;
          const h = Math.max(...ys) - y + pad;

          const frameId = `shape:cluster_${Date.now()}_${Math.random().toString(36).slice(2)}` as TLShapeId;
          editor.createShape({
            id: frameId,
            type: "frame",
            x, y,
            props: { w, h, name: group.name },
          });

          // Move stickies inside the frame
          for (const sticky of groupShapes) {
            editor.reparentShapes([sticky!.id], frameId);
          }
        }

      scheduleAutoSave();
    } catch (e) {
      setClusterError(e instanceof Error ? e.message : "Clustering failed");
      setTimeout(() => setClusterError(null), 5000);
    } finally {
      setClustering(false);
    }
  }

  // Track which shape is selected to show/hide link button
  const [selectionCount, setSelectionCount] = useState(0);
  const [selectedIsLinked, setSelectedIsLinked] = useState(false);
  const [selectedStickyCount, setSelectedStickyCount] = useState(0);

  const initialSnapshot = whiteboard.state as unknown as TLEditorSnapshot | undefined;

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* Top bar */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/projects/${projectKey}?tab=whiteboards`}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            {projectKey}
          </Link>
          <span className="text-neutral-200">/</span>
          {editingName ? (
            <input
              autoFocus
              defaultValue={name}
              onBlur={(e) => saveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName(e.currentTarget.value)}
              className="rounded border border-neutral-300 px-2 py-0.5 text-sm font-medium outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          ) : (
            <button
              onClick={() => canEdit && setEditingName(true)}
              className={`text-sm font-semibold text-neutral-900 ${canEdit ? "hover:underline" : ""}`}
            >
              {name}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Issue link controls — show when exactly 1 shape selected */}
          {canEdit && selectionCount === 1 && (
            selectedIsLinked ? (
              <button
                onClick={handleUnlinkShape}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 transition"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
                Unlink
              </button>
            ) : (
              <button
                onClick={handleLinkIssue}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 transition"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
                Link Issue
              </button>
            )
          )}

          {/* AI clustering — show when 2+ stickies selected */}
          {canEdit && selectedStickyCount >= 2 && (
            <button
              onClick={handleClusterStickies}
              disabled={clustering}
              className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-100 transition disabled:opacity-60"
            >
              {clustering ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Clustering…
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                  </svg>
                  Cluster with AI ({selectedStickyCount})
                </>
              )}
            </button>
          )}
          {clusterError && (
            <span className="text-xs text-red-500">{clusterError}</span>
          )}

          {!canEdit && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">View only</span>
          )}
          {canEdit && (
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Tldraw canvas — fills remaining height */}
      <div className="relative flex-1 overflow-hidden">
        <Tldraw
          snapshot={initialSnapshot}
          components={{
            InFrontOfTheCanvas: () => (
              <IssueBadgesOverlay
                linkedIssues={linkedIssues}
                onBadgeClick={setFlyoutIssue}
              />
            ),
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            if (!canEdit) {
              editor.updateInstanceState({ isReadonly: true });
            }

            // Initial scan for linked issues
            refreshLinkedIssues(editor);

            // Poll every 30s to refresh issue statuses
            const pollInterval = setInterval(() => refreshLinkedIssues(editor), 30_000);

            // Track selection to show/hide link/cluster buttons, and trigger auto-save
            const unsubAll = editor.store.listen(() => {
              const selected = [...editor.getSelectedShapeIds()];
              setSelectionCount(selected.length);
              if (selected.length === 1) {
                const shape = editor.getShape(selected[0]);
                setSelectedIsLinked(!!(shape?.meta?.issueId));
              } else {
                setSelectedIsLinked(false);
              }
              const stickyCount = selected.filter((id) => {
                const s = editor.getShape(id);
                return s?.type === "note";
              }).length;
              setSelectedStickyCount(stickyCount);
              scheduleAutoSave();
            }, { scope: "all" });

            return () => {
              clearInterval(pollInterval);
              unsubAll();
            };
          }}
        />

        {/* Issue flyout */}
        {flyoutIssue && (
          <IssueFlyout
            issue={flyoutIssue}
            slug={slug}
            projectKey={projectKey}
            onClose={() => setFlyoutIssue(null)}
          />
        )}
      </div>

      {/* Issue search modal */}
      {showLinkModal && (
        <IssueSearchModal
          projectKey={projectKey}
          onSelect={handleIssueSelected}
          onClose={() => { setShowLinkModal(false); setSelectedShapeId(null); }}
        />
      )}
    </div>
  );
}
