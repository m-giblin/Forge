"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { createLowlight } from "lowlight";
import js from "highlight.js/lib/languages/javascript";
import ts from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import { useEffect, useCallback, useRef, useState } from "react";
import { marked } from "marked";

const lowlight = createLowlight();
lowlight.register("javascript", js);
lowlight.register("typescript", ts);
lowlight.register("python", python);
lowlight.register("sql", sql);
lowlight.register("bash", bash);
lowlight.register("css", css);
lowlight.register("json", json);

interface Props {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

export default function RichEditor({ content, onChange, onSave, readOnly = false, placeholder }: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing… type / to insert a block",
      }),
    ],
    content: content || "",
    editable: !readOnly,
    onUpdate({ editor }) {
      const json = JSON.stringify(editor.getJSON());
      onChange(json);
      setSaveState("unsaved");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        setSaveState("saving");
        onSave?.();
        setTimeout(() => setSaveState("saved"), 600);
      }, 1200);
    },
    editorProps: {
      attributes: {
        class: "prose prose-neutral max-w-none focus:outline-none min-h-[400px] px-2 py-1",
      },
    },
  });

  // Sync external content changes (e.g. switching pages)
  useEffect(() => {
    if (!editor) return;
    try {
      const parsed = JSON.parse(content);
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
        editor.commands.setContent(parsed, { emitUpdate: false });
      }
    } catch {
      // Content is not JSON — treat as markdown and convert to HTML for display
      const html = content ? (marked.parse(content) as string) : "";
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [content, editor]);

  // Slash command handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "/" && !showSlash) {
        setShowSlash(true);
        setSlashQuery("");
        setSlashIndex(0);
        return;
      }
      if (!showSlash) return;

      if (e.key === "Escape") { setShowSlash(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => i + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Backspace" && slashQuery === "") { setShowSlash(false); return; }
      if (e.key.length === 1) setSlashQuery((q) => q + e.key);
    },
    [showSlash, slashQuery]
  );

  const SLASH_COMMANDS = [
    { label: "Heading 1", icon: "H1", action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", icon: "H2", action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", icon: "H3", action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Bullet List", icon: "•", action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Numbered List", icon: "1.", action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Code Block", icon: "</>", action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: "Quote / Callout", icon: "❝", action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: "Table", icon: "⊞", action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: "Divider", icon: "—", action: () => editor?.chain().focus().setHorizontalRule().run() },
  ];

  const filtered = SLASH_COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashQuery.toLowerCase())
  );
  const clampedIndex = Math.min(slashIndex, filtered.length - 1);

  const execSlash = (cmd: typeof SLASH_COMMANDS[0]) => {
    // Delete the slash + query characters typed
    if (editor) {
      const { from } = editor.state.selection;
      editor.chain().focus().deleteRange({ from: from - slashQuery.length - 1, to: from }).run();
    }
    cmd.action();
    setShowSlash(false);
    setSlashQuery("");
  };

  if (!editor) return null;

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 bg-neutral-50 px-3 py-1.5 sticky top-0 z-10">
          <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (⌘B)">
            <b>B</b>
          </ToolBtn>
          <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (⌘I)">
            <i>I</i>
          </ToolBtn>
          <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <u>U</u>
          </ToolBtn>
          <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <s>S</s>
          </ToolBtn>
          <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
            <span className="font-mono text-[11px]">`c`</span>
          </ToolBtn>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            H1
          </ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            H2
          </ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            H3
          </ToolBtn>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            •≡
          </ToolBtn>
          <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            1≡
          </ToolBtn>
          <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Callout / quote">
            ❝
          </ToolBtn>
          <ToolBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
            <span className="font-mono text-[11px]">{`</>`}</span>
          </ToolBtn>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn active={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
            ⊞
          </ToolBtn>
          {editor.isActive("table") && (
            <>
              <ToolBtn active={false} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">+col</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">+row</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column" danger>-col</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row" danger>-row</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table" danger>✕tbl</ToolBtn>
            </>
          )}
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">—</ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">⬛≡</ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center">⏺</ToolBtn>

          {/* Autosave status */}
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-neutral-400">
            {saveState === "saving" && <span className="animate-pulse">Saving…</span>}
            {saveState === "saved" && <span className="text-emerald-500">✓ Saved</span>}
            {saveState === "unsaved" && <span>Unsaved</span>}
          </div>
        </div>
      )}

      {/* Inline selection toolbar is handled by the sticky header above */}

      {/* Slash command menu */}
      {showSlash && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Insert block
          </div>
          {filtered.map((cmd, i) => (
            <button
              key={cmd.label}
              onMouseDown={(e) => { e.preventDefault(); execSlash(cmd); }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${i === clampedIndex ? "bg-indigo-50 text-indigo-700" : "text-neutral-700 hover:bg-neutral-50"}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-mono text-[11px] font-bold text-neutral-600">
                {cmd.icon}
              </span>
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="px-4 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolBtn({
  children, active, onClick, title, danger,
}: {
  children: React.ReactNode; active: boolean; onClick?: () => void; title?: string; danger?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
      title={title}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[11px] font-semibold transition
        ${active ? "bg-neutral-900 text-white" : danger ? "text-red-500 hover:bg-red-50" : "text-neutral-600 hover:bg-neutral-200"}`}
    >
      {children}
    </button>
  );
}
