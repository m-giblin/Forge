"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { MindMapNode } from "@/lib/services/mindMap";
import {
  createEpicFromMindMapAction,
  createSprintFromMindMapAction,
  createIssueFromMindMapAction,
} from "./actions";

const KIND_STYLES: Record<MindMapNode["kind"], { border: string; label: string; labelText: string }> = {
  idea: { border: "border-l-violet-500", label: "Idea", labelText: "text-violet-600" },
  project: { border: "border-l-indigo-600", label: "Project", labelText: "text-indigo-600" },
  epic: { border: "border-l-cyan-600", label: "Epic", labelText: "text-cyan-600" },
  sprint: { border: "border-l-amber-600", label: "Sprint", labelText: "text-amber-700" },
  issue: { border: "border-l-neutral-500", label: "Issue", labelText: "text-neutral-500" },
};

const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500",
  closed: "bg-emerald-500",
  in_progress: "bg-blue-500",
  progress: "bg-blue-500",
  todo: "bg-neutral-300",
  blocked: "bg-red-500",
};

const CHILD_KIND: Partial<Record<MindMapNode["kind"], { kind: string; label: string }>> = {
  project: { kind: "epic", label: "Epic" },
  epic: { kind: "sprint", label: "Sprint" },
  sprint: { kind: "issue", label: "Issue" },
};

type FlowNodeData = {
  node: MindMapNode;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onOpen: (node: MindMapNode) => void;
  onAddChild: (parent: MindMapNode, title: string) => Promise<void>;
};

function MindMapCard({ data }: NodeProps<Node<FlowNodeData>>) {
  const { node, hasChildren, collapsed, onToggle, onOpen, onAddChild } = data;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const styles = KIND_STYLES[node.kind];
  const childSpec = CHILD_KIND[node.kind];

  function submitAdd() {
    if (!title.trim()) return;
    startTransition(async () => {
      await onAddChild(node, title.trim());
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div className="w-[220px] relative">
      <Handle type="target" position={Position.Left} className="!bg-neutral-300" />
      <div
        className={`rounded-lg border border-neutral-200 ${styles.border} border-l-4 bg-white shadow-sm px-3 py-2 cursor-pointer hover:shadow-md transition-shadow`}
        onClick={() => onOpen(node)}
      >
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-[9.5px] font-bold uppercase tracking-wide ${styles.labelText}`}>{styles.label}</span>
          {node.status && (
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[node.status] ?? "bg-neutral-300"}`} />
          )}
        </div>
        <div className="text-[13px] font-semibold leading-snug text-neutral-900">{node.title}</div>
        {node.meta && <div className="text-[10.5px] text-neutral-500 mt-1">{node.meta}</div>}
        {typeof node.progress === "number" && (
          <div className="h-1 rounded bg-neutral-100 mt-1.5 overflow-hidden">
            <div className="h-full rounded bg-emerald-500" style={{ width: `${node.progress}%` }} />
          </div>
        )}
      </div>

      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border border-neutral-300 bg-white text-[11px] font-bold text-neutral-500 shadow-sm hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "+" : "–"}
        </button>
      )}

      {childSpec && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          {adding ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder={`${childSpec.label} title`}
                className="flex-1 min-w-0 rounded border border-neutral-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="button"
                disabled={pending}
                onClick={submitAdd}
                className="rounded bg-indigo-600 px-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {pending ? "…" : "Add"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-[10.5px] font-medium text-neutral-400 hover:text-indigo-600"
            >
              + Add {childSpec.label.toLowerCase()}
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-neutral-300" />
    </div>
  );
}

const NODE_TYPES = { mindMapCard: MindMapCard };

const NODE_W = 240;
const NODE_H = 96;

function layout(root: MindMapNode, collapsedIds: Set<string>) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 90 });

  const flowNodes: { id: string; node: MindMapNode; hasChildren: boolean }[] = [];
  const flowEdges: Edge[] = [];

  (function walk(n: MindMapNode) {
    const hasChildren = n.children.length > 0;
    flowNodes.push({ id: n.id, node: n, hasChildren });
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
    if (collapsedIds.has(n.id)) return;
    for (const child of n.children) {
      g.setEdge(n.id, child.id);
      flowEdges.push({ id: `${n.id}->${child.id}`, source: n.id, target: child.id, type: "smoothstep", animated: false });
      walk(child);
    }
  })(root);

  dagre.layout(g);

  const nodes: Node<FlowNodeData>[] = flowNodes
    .filter((fn) => g.node(fn.id) !== undefined)
    .map((fn) => {
      const pos = g.node(fn.id);
      return {
        id: fn.id,
        type: "mindMapCard",
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
        data: { node: fn.node, hasChildren: fn.hasChildren, collapsed: collapsedIds.has(fn.id) } as unknown as FlowNodeData,
        draggable: true,
      };
    });

  return { nodes, edges: flowEdges };
}

export default function MindMapCanvas({
  slug,
  projectKey,
  projectId,
  initialTree,
}: {
  slug: string;
  projectKey: string;
  projectId: string;
  initialTree: MindMapNode;
}) {
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Dagre recomputes every node's position on each layout(); a dragged node's
  // position is stored here and overlaid on top so a drag survives expand/
  // collapse and "+ Add" instead of snapping back to the auto-layout spot.
  const [dragOverrides, setDragOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setDragOverrides((prev) => {
      let next = prev;
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (next === prev) next = new Map(prev);
          next.set(change.id, change.position);
        }
      }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const open = useCallback(
    (node: MindMapNode) => {
      if (node.href) router.push(node.href);
    },
    [router]
  );

  const addChild = useCallback(
    async (parent: MindMapNode, title: string) => {
      if (parent.kind === "project") {
        await createEpicFromMindMapAction(slug, projectKey, projectId, title);
      } else if (parent.kind === "epic") {
        const epicId = parent.id.replace(/^epic-/, "");
        await createSprintFromMindMapAction(slug, projectKey, projectId, epicId, title);
      } else if (parent.kind === "sprint") {
        const sprintId = parent.id.replace(/^sprint-/, "");
        await createIssueFromMindMapAction(slug, projectKey, projectId, sprintId, title);
      }
      router.refresh();
    },
    [slug, projectKey, projectId, router]
  );

  // Server passes a freshly revalidated tree after router.refresh() (e.g. once
  // an add-child action commits); resync local state to it.
  useEffect(() => {
    setTree(initialTree);
  }, [initialTree]);

  const { nodes: laidOutNodes, edges } = useMemo(() => layout(tree, collapsed), [tree, collapsed]);

  const nodes = useMemo(
    () =>
      laidOutNodes.map((n) => ({
        ...n,
        position: dragOverrides.get(n.id) ?? n.position,
        data: { ...n.data, onToggle: toggle, onOpen: open, onAddChild: addChild } as FlowNodeData,
      })),
    [laidOutNodes, toggle, open, addChild, dragOverrides]
  );

  return (
    <div className="h-[calc(100vh-220px)] min-h-[520px] w-full rounded-xl border border-neutral-200 bg-neutral-50 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: "#d4d4d8", strokeWidth: 1.75 } }}
      >
        <Background gap={22} color="#e4e4e7" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
