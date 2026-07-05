"use client";

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";

// ── Status chip colors ────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  todo:        { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
  backlog:     { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
  in_progress: { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
  in_review:   { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  done:        { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
};
const STATUS_LABELS: Record<string, string> = {
  todo: "Todo", backlog: "Backlog", in_progress: "In Progress", in_review: "In Review", done: "Done",
};

// ── IssueChip React component ─────────────────────────────────────────────────
function IssueChip({ node, slug }: { node: { attrs: { issueKey: string } }; slug: string }) {
  const issueKey = node.attrs.issueKey;
  const [data, setData] = useState<{ title: string; status: string; id: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!issueKey) return;
    const parts = issueKey.split("-");
    if (parts.length < 2) return;
    const projectKey = parts.slice(0, -1).join("-");

    fetch(`/api/v1/issues?project=${projectKey}&q=${issueKey}&limit=5`)
      .then((r) => r.json())
      .then((json) => {
        const match = (json.data ?? []).find((i: { key: string }) => i.key === issueKey);
        if (match) setData({ title: match.title, status: match.status, id: match.id });
        else setError(true);
      })
      .catch(() => setError(true));
  }, [issueKey, slug]);

  const style = data ? (STATUS_STYLE[data.status] ?? STATUS_STYLE.todo) : null;

  if (error) {
    // Unknown key — render as plain monospace text
    return (
      <NodeViewWrapper as="span" style={{ display: "inline" }}>
        <code style={{ fontFamily: "monospace", fontSize: "0.875em", color: "#6b7280" }}>{issueKey}</code>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }}>
      <a
        href={data ? `/${slug}/projects/${issueKey.split("-")[0]}/issues/${data.id}` : undefined}
        title={data?.title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 5,
          padding: "1px 6px",
          fontSize: "0.8em",
          fontFamily: "monospace",
          fontWeight: 600,
          textDecoration: "none",
          verticalAlign: "middle",
          cursor: data ? "pointer" : "default",
          background: style?.bg ?? "#f3f4f6",
          color: style?.text ?? "#374151",
          border: `1px solid ${style?.border ?? "#d1d5db"}`,
          transition: "opacity 0.15s",
          userSelect: "none",
        }}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
      >
        {issueKey}
        {data && (
          <span style={{ fontFamily: "sans-serif", fontWeight: 500, fontSize: "0.85em", opacity: 0.8 }}>
            {STATUS_LABELS[data.status] ?? data.status}
          </span>
        )}
        {!data && <span style={{ opacity: 0.4, fontFamily: "sans-serif", fontWeight: 400 }}>…</span>}
      </a>
    </NodeViewWrapper>
  );
}

// ── Tiptap extension factory ───────────────────────────────────────────────────
// Pattern: one or more uppercase letters, a dash, one or more digits (e.g. FORGE-42, WEB-123)
const ISSUE_KEY_REGEX = /\b([A-Z][A-Z0-9]*-\d+)\b/;

export function createIssueKeyExtension(slug: string) {
  return Node.create({
    name: "issueKey",
    group: "inline",
    inline: true,
    atom: true,

    addOptions() {
      return { slug };
    },

    addAttributes() {
      return {
        issueKey: { default: null, parseHTML: (el) => el.getAttribute("data-issue-key") },
      };
    },

    parseHTML() {
      return [{ tag: "span[data-issue-key]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes(HTMLAttributes, { "data-issue-key": HTMLAttributes.issueKey }), 0];
    },

    addNodeView() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ReactNodeViewRenderer((props: any) => (
        <IssueChip node={props.node} slug={this.options.slug} />
      ));
    },

    addInputRules() {
      return [
        new InputRule({
          find: new RegExp(`(?:^|\\s)(${ISSUE_KEY_REGEX.source})\\s$`),
          handler: ({ state, range, match }) => {
            const issueKey = match[1];
            if (!issueKey) return;
            const { tr } = state;
            const node = this.type.create({ issueKey });
            tr.replaceRangeWith(range.from, range.to - 1, node);
          },
        }),
      ];
    },
  });
}
