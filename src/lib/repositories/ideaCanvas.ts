import type { SupabaseClient } from "@supabase/supabase-js";

export type IdeaCanvasNodeKind = "problem" | "feature" | "risk" | "question" | "ai";

export type IdeaCanvasNode = {
  id: string;
  tenantId: string;
  ideaId: string;
  kind: IdeaCanvasNodeKind;
  text: string;
  posX: number;
  posY: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IdeaCanvasEdge = {
  id: string;
  tenantId: string;
  ideaId: string;
  fromNode: string;
  toNode: string;
  isAi: boolean;
  createdAt: string;
};

function mapNode(r: Record<string, unknown>): IdeaCanvasNode {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    ideaId: r.idea_id as string,
    kind: r.kind as IdeaCanvasNodeKind,
    text: r.text as string,
    posX: r.pos_x as number,
    posY: r.pos_y as number,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapEdge(r: Record<string, unknown>): IdeaCanvasEdge {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    ideaId: r.idea_id as string,
    fromNode: r.from_node as string,
    toNode: r.to_node as string,
    isAi: r.is_ai as boolean,
    createdAt: r.created_at as string,
  };
}

const NODE_COLS = "id, tenant_id, idea_id, kind, text, pos_x, pos_y, created_by, created_at, updated_at";
const EDGE_COLS = "id, tenant_id, idea_id, from_node, to_node, is_ai, created_at";

export function ideaCanvasRepo(supabase: SupabaseClient) {
  return {
    async listNodes(tenantId: string, ideaId: string): Promise<IdeaCanvasNode[]> {
      const { data, error } = await supabase
        .from("idea_canvas_nodes")
        .select(NODE_COLS)
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapNode(r as Record<string, unknown>));
    },

    async listEdges(tenantId: string, ideaId: string): Promise<IdeaCanvasEdge[]> {
      const { data, error } = await supabase
        .from("idea_canvas_edges")
        .select(EDGE_COLS)
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId);
      if (error) throw error;
      return (data ?? []).map((r) => mapEdge(r as Record<string, unknown>));
    },

    async createNode(input: {
      tenantId: string;
      ideaId: string;
      kind: IdeaCanvasNodeKind;
      text: string;
      posX: number;
      posY: number;
      createdBy?: string | null;
    }): Promise<IdeaCanvasNode> {
      const { data, error } = await supabase
        .from("idea_canvas_nodes")
        .insert({
          tenant_id: input.tenantId,
          idea_id: input.ideaId,
          kind: input.kind,
          text: input.text,
          pos_x: input.posX,
          pos_y: input.posY,
          created_by: input.createdBy ?? null,
        })
        .select(NODE_COLS)
        .single();
      if (error) throw error;
      return mapNode(data as Record<string, unknown>);
    },

    async updateNode(
      tenantId: string,
      nodeId: string,
      patch: { text?: string; posX?: number; posY?: number }
    ): Promise<void> {
      const { error } = await supabase
        .from("idea_canvas_nodes")
        .update({
          ...(patch.text !== undefined ? { text: patch.text } : {}),
          ...(patch.posX !== undefined ? { pos_x: patch.posX } : {}),
          ...(patch.posY !== undefined ? { pos_y: patch.posY } : {}),
        })
        .eq("tenant_id", tenantId)
        .eq("id", nodeId);
      if (error) throw error;
    },

    async deleteNode(tenantId: string, nodeId: string): Promise<void> {
      const { error } = await supabase.from("idea_canvas_nodes").delete().eq("tenant_id", tenantId).eq("id", nodeId);
      if (error) throw error;
    },

    async createEdge(input: {
      tenantId: string;
      ideaId: string;
      fromNode: string;
      toNode: string;
      isAi?: boolean;
    }): Promise<IdeaCanvasEdge> {
      const { data, error } = await supabase
        .from("idea_canvas_edges")
        .insert({
          tenant_id: input.tenantId,
          idea_id: input.ideaId,
          from_node: input.fromNode,
          to_node: input.toNode,
          is_ai: input.isAi ?? false,
        })
        .select(EDGE_COLS)
        .single();
      if (error) throw error;
      return mapEdge(data as Record<string, unknown>);
    },

    async deleteEdge(tenantId: string, edgeId: string): Promise<void> {
      const { error } = await supabase.from("idea_canvas_edges").delete().eq("tenant_id", tenantId).eq("id", edgeId);
      if (error) throw error;
    },
  };
}
