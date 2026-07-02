import { createHash } from "node:crypto";

export const ATLAS_FLOW_NODE_TYPES = [
  "capability",
  "approval",
  "human_provider",
  "wait",
  "parallel",
  "compensation"
] as const;

export type AtlasFlowNodeType = (typeof ATLAS_FLOW_NODE_TYPES)[number];

export const ATLAS_FLOW_EDGE_TYPES = [
  "sequence",
  "conditional",
  "on_failure",
  "compensation"
] as const;

export type AtlasFlowEdgeType = (typeof ATLAS_FLOW_EDGE_TYPES)[number];

export interface AtlasFlowNode {
  id: string;
  type: AtlasFlowNodeType;
  inputs: Record<string, unknown>;
}

export interface AtlasFlowEdge {
  id: string;
  type: AtlasFlowEdgeType;
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

export interface AtlasFlowValidation {
  valid: boolean;
  errors: string[];
}

export const SUPPORTED_ATLAS_SOURCE_FORMATS = ["atl", "atlasflow"] as const;

export type AtlasSourceFormat = (typeof SUPPORTED_ATLAS_SOURCE_FORMATS)[number];

export interface AtlasSourceDocumentInput {
  id: string;
  format: AtlasSourceFormat;
  version: string;
  source: string;
  createdAt: string;
  createdBy: string;
}

export interface AtlasSourceDocument extends AtlasSourceDocumentInput {
  mimeType: "text/atlas-atl" | "application/atlasflow+json";
  sourceHash: string;
}

export const ATLAS_IR_OPS = [
  "resolve_capability",
  "rank_provider",
  "execute_provider",
  "execute_workflow",
  "wait_for_approval",
  "delegate_human",
  "checkpoint",
  "rollback",
  "compensate"
] as const;

export type AtlasIROp = (typeof ATLAS_IR_OPS)[number];

export interface AtlasIRInstruction {
  op: AtlasIROp;
  args: Record<string, unknown>;
}

export interface AtlasIRInput {
  id: string;
  sourceDocumentId: string;
  version: string;
  instructions: AtlasIRInstruction[];
  createdAt: string;
  createdBy: string;
  checksum?: string;
}

export interface AtlasIR {
  id: string;
  sourceDocumentId: string;
  version: string;
  instructions: AtlasIRInstruction[];
  createdAt: string;
  createdBy: string;
  checksum: string;
}

export interface AtlasIRReplayPlan {
  irId: string;
  sourceDocumentId: string;
  version: string;
  checksum: string;
  valid: boolean;
  instructions: AtlasIRInstruction[];
  error?: string;
}

export function createAtlasSourceDocument(
  input: AtlasSourceDocumentInput
): AtlasSourceDocument {
  return {
    ...input,
    mimeType: input.format === "atl" ? "text/atlas-atl" : "application/atlasflow+json",
    sourceHash: sha256(input.source)
  };
}

export function createAtlasFlow(input: AtlasFlow): AtlasFlow {
  const validation = validateAtlasFlow(input);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  return {
    id: input.id,
    version: input.version,
    nodes: input.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      inputs: { ...node.inputs }
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      ...(edge.condition === undefined ? {} : { condition: edge.condition })
    }))
  };
}

export function validateAtlasFlow(input: AtlasFlow): AtlasFlowValidation {
  const errors: string[] = [];
  const nodeIds = new Set<string>();

  if (input.nodes.length === 0) {
    errors.push("AtlasFlow workflow must include at least one node.");
  }

  for (const node of input.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate AtlasFlow node id: ${node.id}`);
    }

    nodeIds.add(node.id);

    if (!isAtlasFlowNodeType(node.type)) {
      errors.push(`Unsupported AtlasFlow node type: ${String(node.type)}`);
    }
  }

  for (const edge of input.edges) {
    if (!isAtlasFlowEdgeType(edge.type)) {
      errors.push(`Unsupported AtlasFlow edge type: ${String(edge.type)}`);
    }

    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(`AtlasFlow edge source node not found: ${edge.fromNodeId}`);
    }

    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(`AtlasFlow edge target node not found: ${edge.toNodeId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createAtlasIR(input: AtlasIRInput): AtlasIR {
  const ir = {
    id: input.id,
    sourceDocumentId: input.sourceDocumentId,
    version: input.version,
    instructions: input.instructions.map((instruction) => ({
      op: instruction.op,
      args: { ...instruction.args }
    })),
    createdAt: input.createdAt,
    createdBy: input.createdBy
  };

  return {
    ...ir,
    checksum: sha256(stableStringify(ir))
  };
}

export function createAtlasIRReplayPlan(ir: AtlasIR): AtlasIRReplayPlan {
  const expected = createAtlasIR({
    id: ir.id,
    sourceDocumentId: ir.sourceDocumentId,
    version: ir.version,
    instructions: ir.instructions,
    createdAt: ir.createdAt,
    createdBy: ir.createdBy
  });

  if (expected.checksum !== ir.checksum) {
    return {
      irId: ir.id,
      sourceDocumentId: ir.sourceDocumentId,
      version: ir.version,
      checksum: ir.checksum,
      valid: false,
      instructions: [],
      error: "AtlasIR checksum mismatch"
    };
  }

  return {
    irId: ir.id,
    sourceDocumentId: ir.sourceDocumentId,
    version: ir.version,
    checksum: ir.checksum,
    valid: true,
    instructions: ir.instructions.map((instruction) => ({
      op: instruction.op,
      args: { ...instruction.args }
    }))
  };
}

function isAtlasFlowNodeType(value: string): value is AtlasFlowNodeType {
  return ATLAS_FLOW_NODE_TYPES.includes(value as AtlasFlowNodeType);
}

function isAtlasFlowEdgeType(value: string): value is AtlasFlowEdgeType {
  return ATLAS_FLOW_EDGE_TYPES.includes(value as AtlasFlowEdgeType);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
