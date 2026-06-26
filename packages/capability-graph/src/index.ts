export type CapabilityGraphStatus = "draft" | "trusted" | "production";

export interface CapabilityNode {
  id: string;
  name: string;
  level: "L0" | "L1" | "L2" | "L3" | "L4";
  confidence: number;
}

export interface CapabilityEdge {
  fromCapabilityId: string;
  toCapabilityId: string;
  relationship: "requires" | "composes" | "fallbacks_to";
}

export interface CapabilityGraph {
  id: string;
  status: CapabilityGraphStatus;
  nodes: CapabilityNode[];
  edges: CapabilityEdge[];
}
