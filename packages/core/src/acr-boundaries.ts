import type { ACREvidenceRef, ACRLifecycle, ACRObjectType } from "./acr.js";
import type { ACRObject } from "./acr.js";

export interface RawEvidenceInput {
  id: string;
  sourceType: ACREvidenceRef["sourceType"];
  capturedAt: string;
  capturedBy: string;
  storageUri: string;
  contentHash: string;
  contentType: string;
  byteLength: number;
  metadata?: Record<string, string>;
}

export interface RawEvidenceRecord {
  id: string;
  sourceType: ACREvidenceRef["sourceType"];
  capturedAt: string;
  capturedBy: string;
  storage: {
    uri: string;
    contentHash: string;
    contentType: string;
    byteLength: number;
  };
  metadata: Record<string, string>;
}

export interface ACRSearchProjectionInput {
  sourceEventId: string;
  projectedAt: string;
  embeddingRef?: string;
}

export interface ACRSearchProjectionRecord {
  objectId: string;
  objectType: ACRObjectType;
  objectVersion: number;
  lifecycle: ACRLifecycle;
  sourceEventId: string;
  projectedAt: string;
  indexedText: string;
  embeddingRef?: string;
  relationshipTargetIds: string[];
  evidenceSourceIds: string[];
  policyRefs: string[];
}

export function createRawEvidenceRecord(input: RawEvidenceInput): RawEvidenceRecord {
  return {
    id: input.id,
    sourceType: input.sourceType,
    capturedAt: input.capturedAt,
    capturedBy: input.capturedBy,
    storage: {
      uri: input.storageUri,
      contentHash: input.contentHash,
      contentType: input.contentType,
      byteLength: input.byteLength
    },
    metadata: input.metadata ?? {}
  };
}

export function createACRSearchProjectionRecord(
  object: ACRObject,
  input: ACRSearchProjectionInput
): ACRSearchProjectionRecord {
  return {
    objectId: object.id,
    objectType: object.type,
    objectVersion: object.version,
    lifecycle: object.lifecycle,
    sourceEventId: input.sourceEventId,
    projectedAt: input.projectedAt,
    indexedText: buildIndexedText(object),
    ...(input.embeddingRef === undefined ? {} : { embeddingRef: input.embeddingRef }),
    relationshipTargetIds: object.relationships.map(
      (relationship) => relationship.targetId
    ),
    evidenceSourceIds: object.evidence.map((evidence) => evidence.sourceId),
    policyRefs: [...object.policies]
  };
}

function buildIndexedText(object: ACRObject): string {
  return [object.type, object.lifecycle, ...payloadTextParts(object.payload)]
    .filter((part) => part.length > 0)
    .join(" ");
}

function payloadTextParts(payload: unknown): string[] {
  if (typeof payload === "string") {
    return [payload];
  }

  if (!isRecord(payload)) {
    return [];
  }

  return ["title", "name", "summary", "description"]
    .map((key) => payload[key])
    .filter((value): value is string => typeof value === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
