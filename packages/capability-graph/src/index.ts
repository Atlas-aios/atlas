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

export interface CapabilityGraphStore {
  save(graph: CapabilityGraph): void;
  get(graphId: string): CapabilityGraph | undefined;
  list(): CapabilityGraph[];
}

export interface TraverseCapabilityGraphInput {
  graph: CapabilityGraph;
  startCapabilityId: string;
  relationships: CapabilityEdge["relationship"][];
  maxDepth: number;
}

export interface TraverseCapabilityGraphResult {
  startCapabilityId: string;
  visitedCapabilityIds: string[];
  edges: CapabilityEdge[];
}

export interface SearchCapabilityGraphInput {
  graph: CapabilityGraph;
  query: string;
  levels: CapabilityLevel[];
  minimumConfidence: number;
}

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

export function createInMemoryCapabilityGraphStore(): CapabilityGraphStore {
  const graphs = new Map<string, CapabilityGraph>();

  return {
    save(graph) {
      graphs.set(graph.id, graph);
    },
    get(graphId) {
      return graphs.get(graphId);
    },
    list() {
      return [...graphs.values()];
    }
  };
}

export function traverseCapabilityGraph(
  input: TraverseCapabilityGraphInput
): TraverseCapabilityGraphResult {
  const visitedCapabilityIds: string[] = [input.startCapabilityId];
  const visited = new Set<string>(visitedCapabilityIds);
  const edges: CapabilityEdge[] = [];
  const queue: Array<{ capabilityId: string; depth: number }> = [
    { capabilityId: input.startCapabilityId, depth: 0 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current.depth >= input.maxDepth) {
      continue;
    }

    const matchingEdges = input.graph.edges.filter(
      (edge) =>
        edge.fromCapabilityId === current.capabilityId &&
        input.relationships.includes(edge.relationship)
    );

    for (const edge of matchingEdges) {
      edges.push(edge);
      if (!visited.has(edge.toCapabilityId)) {
        visited.add(edge.toCapabilityId);
        visitedCapabilityIds.push(edge.toCapabilityId);
        queue.push({
          capabilityId: edge.toCapabilityId,
          depth: current.depth + 1
        });
      }
    }
  }

  return {
    startCapabilityId: input.startCapabilityId,
    visitedCapabilityIds,
    edges
  };
}

export function searchCapabilityGraph(
  input: SearchCapabilityGraphInput
): CapabilityNode[] {
  const normalizedQuery = input.query.trim().toLowerCase();
  return input.graph.nodes.filter(
    (node) =>
      input.levels.includes(node.level) &&
      node.confidence >= input.minimumConfidence &&
      node.name.toLowerCase().includes(normalizedQuery)
  );
}
