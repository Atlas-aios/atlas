export type AtlasFlowNodeType =
  | "capability"
  | "approval"
  | "human_provider"
  | "wait"
  | "parallel"
  | "compensation";

export interface AtlasFlowNode {
  id: string;
  type: AtlasFlowNodeType;
  inputs: Record<string, unknown>;
}

export interface AtlasFlowEdge {
  fromNodeId: string;
  toNodeId: string;
  condition?: string;
}

export interface AtlasFlow {
  id: string;
  version: string;
  nodes: AtlasFlowNode[];
  edges: AtlasFlowEdge[];
}
