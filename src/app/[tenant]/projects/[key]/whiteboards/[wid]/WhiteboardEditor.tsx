"use client";

import { useCallback, useRef, useState } from "react";
import { Tldraw, type Editor, type TLEditorSnapshot } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";

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

  const apiBase = `/api/projects/${projectId}/whiteboards/${whiteboard.id}?slug=${slug}`;

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

        <div className="flex items-center gap-3">
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
      <div className="flex-1 overflow-hidden">
        <Tldraw
          snapshot={initialSnapshot}
          onMount={(editor) => {
            editorRef.current = editor;
            if (!canEdit) {
              editor.updateInstanceState({ isReadonly: true });
            }
            editor.store.listen(() => {
              scheduleAutoSave();
            });
          }}
        />
      </div>
    </div>
  );
}
