export type CapabilityGraphStatus = "draft" | "trusted" | "production";

export const CAPABILITY_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;

export type CapabilityLevel = (typeof CAPABILITY_LEVELS)[number];

export interface CapabilityNode {
  id: string;
  schemaVersion: "0.1";
  name: string;
  level: CapabilityLevel;
  confidence: number;
  sourceRefs: string[];
}

export interface CapabilityEdge {
  fromCapabilityId: string;
  toCapabilityId: string;
  relationship: "requires" | "composes" | "fallbacks_to";
}

export interface CapabilityGraph {
  id: string;
  schemaVersion: "0.1";
  status: CapabilityGraphStatus;
  generatedAt: string;
  nodes: CapabilityNode[];
  edges: CapabilityEdge[];
}

export type CapabilityNodeInput = Omit<CapabilityNode, "schemaVersion">;
export type CapabilityGraphInput = Omit<CapabilityGraph, "schemaVersion">;

export function createCapabilityNode(input: CapabilityNodeInput): CapabilityNode {
  return {
    id: input.id,
    schemaVersion: "0.1",
    name: input.name,
    level: input.level,
    confidence: input.confidence,
    sourceRefs: input.sourceRefs
  };
}

export function createCapabilityGraph(input: CapabilityGraphInput): CapabilityGraph {
  return {
    id: input.id,
    schemaVersion: "0.1",
    status: input.status,
    generatedAt: input.generatedAt,
    nodes: input.nodes,
    edges: input.edges
  };
}
