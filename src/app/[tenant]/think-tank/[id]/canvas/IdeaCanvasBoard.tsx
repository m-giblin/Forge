"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { IdeaCanvasNode, IdeaCanvasEdge, IdeaCanvasNodeKind } from "@/lib/repositories/ideaCanvas";
import {
  createCanvasNodeAction,
  updateCanvasNodeAction,
  deleteCanvasNodeAction,
  createCanvasEdgeAction,
  testIdeaCanvasWithAiAction,
} from "./actions";

const KIND_META: Record<IdeaCanvasNodeKind, { label: string; border: string; text: string; dashed?: boolean; soft?: string }> = {
  problem: { label: "Problem", border: "border-l-rose-600", text: "text-rose-600" },
  feature: { label: "Feature", border: "border-l-emerald-600", text: "text-emerald-600" },
  risk: { label: "Risk", border: "border-l-orange-600", text: "text-orange-600" },
  question: { label: "Question", border: "border-l-sky-600", text: "text-sky-600" },
  ai: { label: "AI suggestion", border: "border-l-violet-600", text: "text-violet-600", dashed: true, soft: "bg-violet-50" },
};

type FlowNodeData = {
  node: IdeaCanvasNode;
  onTextCommit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
};

function CanvasCard({ data }: NodeProps<Node<FlowNodeData>>) {
  const { node, onTextCommit, onDelete } = data;
  const [text, setText] = useState(node.text);
  const meta = KIND_META[node.kind];

  return (
    <div className="w-[180px] relative group">
      <Handle type="target" position={Position.Left} className="!bg-neutral-300" />
      <div
        className={`rounded-lg border ${node.kind === "ai" ? "border-dashed" : ""} border-neutral-200 ${meta.border} border-l-4 ${meta.soft ?? "bg-white"} shadow-sm px-3 py-2`}
      >
        <div className={`text-[9.5px] font-bold uppercase tracking-wide mb-1 ${meta.text}`}>{meta.label}</div>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== node.text) onTextCommit(node.id, text);
          }}
          className="w-full resize-none border-none bg-transparent p-0 text-[12.5px] font-medium leading-snug text-neutral-900 focus:outline-none nodrag"
        />
      </div>
      <button
        type="button"
        onClick={() => onDelete(node.id)}
        className="absolute -top-2 -right-2 hidden h-[18px] w-[18px] items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] text-neutral-400 shadow-sm hover:text-red-600 group-hover:flex"
        title="Delete"
      >
        ×
      </button>
      <Handle type="source" position={Position.Right} className="!bg-neutral-300" />
    </div>
  );
}

const NODE_TYPES = { canvasCard: CanvasCard };

const ADD_KINDS: { kind: IdeaCanvasNodeKind; label: string; placeholder: string }[] = [
  { kind: "problem", label: "Problem", placeholder: "What's the pain point?" },
  { kind: "feature", label: "Feature", placeholder: "What would help?" },
  { kind: "risk", label: "Risk", placeholder: "What could go wrong?" },
  { kind: "question", label: "Question", placeholder: "What's still unresolved?" },
];

function parseAiBullets(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^[\s*\-\d.)]+/, "").trim())
    .filter((line) => line.length > 3);
}

export default function IdeaCanvasBoard(props: {
  slug: string;
  ideaId: string;
  ideaTitle: string;
  initialNodes: IdeaCanvasNode[];
  initialEdges: IdeaCanvasEdge[];
}) {
  return (
    <ReactFlowProvider>
      <IdeaCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function IdeaCanvasInner({
  slug,
  ideaId,
  initialNodes,
  initialEdges,
}: {
  slug: string;
  ideaId: string;
  ideaTitle: string;
  initialNodes: IdeaCanvasNode[];
  initialEdges: IdeaCanvasEdge[];
}) {
  const router = useRouter();
  const [dataNodes, setDataNodes] = useState(initialNodes);
  const [dataEdges, setDataEdges] = useState(initialEdges);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiPending, startAiTransition] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  const onTextCommit = useCallback(
    (id: string, text: string) => {
      setDataNodes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
      void updateCanvasNodeAction(slug, ideaId, id, { text });
    },
    [slug, ideaId]
  );

  const onDelete = useCallback(
    (id: string) => {
      setDataNodes((prev) => prev.filter((n) => n.id !== id));
      setDataEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id));
      void deleteCanvasNodeAction(slug, ideaId, id);
    },
    [slug, ideaId]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      setDataNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, posX: node.position.x, posY: node.position.y } : n)));
      void updateCanvasNodeAction(slug, ideaId, node.id, { posX: node.position.x, posY: node.position.y });
    },
    [slug, ideaId]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      setDataEdges((prev) => [
        ...prev,
        { id: `local-${conn.source}-${conn.target}`, tenantId: "", ideaId, fromNode: conn.source, toNode: conn.target, isAi: false, createdAt: "" },
      ]);
      void createCanvasEdgeAction(slug, ideaId, conn.source, conn.target);
    },
    [slug, ideaId]
  );

  function addCard(kind: IdeaCanvasNodeKind, placeholder: string) {
    // Stagger new cards deterministically by current count rather than
    // Math.random() (flagged as an impure call reachable from render).
    const slot = dataNodes.length % 6;
    const posX = 200 + (slot % 3) * 160;
    const posY = 420 + Math.floor(slot / 3) * 130;
    startAiTransition(async () => {
      const node = await createCanvasNodeAction(slug, ideaId, kind, placeholder, posX, posY);
      setDataNodes((prev) => [...prev, node]);
    });
  }

  function testWithAi() {
    setAiPanelOpen(true);
    setAiText(null);
    setAiError(null);
    startAiTransition(async () => {
      try {
        const text = await testIdeaCanvasWithAiAction(slug, ideaId);
        setAiText(text);
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "AI test failed.");
      }
    });
  }

  function addAiSuggestions() {
    if (!aiText) return;
    const bullets = parseAiBullets(aiText).slice(0, 6);
    startAiTransition(async () => {
      for (let i = 0; i < bullets.length; i++) {
        const node = await createCanvasNodeAction(
          slug,
          ideaId,
          "ai",
          bullets[i],
          900 + (i % 2) * 220,
          150 + Math.floor(i / 2) * 140
        );
        setDataNodes((prev) => [...prev, node]);
      }
      setAiPanelOpen(false);
      router.refresh();
    });
  }

  const flowNodes: Node<FlowNodeData>[] = useMemo(
    () =>
      dataNodes.map((n) => ({
        id: n.id,
        type: "canvasCard",
        position: { x: n.posX, y: n.posY },
        data: { node: n, onTextCommit, onDelete } as FlowNodeData,
        draggable: true,
      })),
    [dataNodes, onTextCommit, onDelete]
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      dataEdges.map((e) => ({
        id: e.id,
        source: e.fromNode,
        target: e.toNode,
        type: "smoothstep",
        style: e.isAi ? { stroke: "#7c3aed", strokeDasharray: "4 5" } : { stroke: "#d4d4d8", strokeWidth: 1.75 },
      })),
    [dataEdges]
  );

  return (
    <div className="flex gap-3">
      <div className="h-[calc(100vh-260px)] min-h-[500px] flex-1 rounded-xl border border-neutral-200 bg-neutral-50 relative">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} color="#e7e2d6" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {aiPanelOpen && (
          <div className="absolute top-0 right-0 h-full w-[320px] overflow-y-auto border-l border-neutral-200 bg-white p-4 shadow-lg z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Test with AI</span>
              <button type="button" onClick={() => setAiPanelOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                ×
              </button>
            </div>
            {aiPending && !aiText && !aiError && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-4">
                <span className="h-3 w-3 rounded-full border-2 border-neutral-300 border-t-violet-500 animate-spin" />
                Thinking through the shape of this idea…
              </div>
            )}
            {aiError && <p className="text-xs text-red-600 mt-4">{aiError}</p>}
            {aiText && (
              <>
                <div className="mt-2 whitespace-pre-wrap rounded-lg bg-violet-50 border border-violet-100 p-3 text-xs leading-relaxed text-neutral-700">
                  {aiText}
                </div>
                <button
                  type="button"
                  onClick={addAiSuggestions}
                  disabled={aiPending}
                  className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {aiPending ? "Adding…" : "+ Add these as AI suggestion cards"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="w-[150px] flex-shrink-0 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2">Add a thought</div>
        <div className="flex flex-col gap-1.5">
          {ADD_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => addCard(k.kind, k.placeholder)}
              className={`flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left text-xs font-medium text-neutral-700 hover:border-neutral-400`}
            >
              <span className={`h-2 w-2 rounded-sm ${KIND_META[k.kind].border.replace("border-l-", "bg-")}`} />
              {k.label}
            </button>
          ))}
        </div>
        <div className="my-3 h-px bg-neutral-100" />
        <button
          type="button"
          onClick={testWithAi}
          disabled={aiPending}
          className="w-full rounded-lg bg-violet-600 px-2.5 py-2 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-50"
        >
          ✨ Test with AI
        </button>
      </div>
    </div>
  );
}
