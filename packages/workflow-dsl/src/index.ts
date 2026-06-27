import { createHash } from "node:crypto";

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

export interface AtlasIRInstruction {
  op: string;
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

export function createAtlasSourceDocument(
  input: AtlasSourceDocumentInput
): AtlasSourceDocument {
  return {
    ...input,
    mimeType: input.format === "atl" ? "text/atlas-atl" : "application/atlasflow+json",
    sourceHash: sha256(input.source)
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
