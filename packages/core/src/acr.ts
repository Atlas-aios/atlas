export const ACR_OBJECT_TYPES = [
  "goal",
  "thought",
  "decision",
  "capability",
  "memory",
  "experience",
  "execution"
] as const;

export type ACRObjectType = (typeof ACR_OBJECT_TYPES)[number];

export const ACR_LIFECYCLES = [
  "draft",
  "validated",
  "active",
  "completed",
  "rejected",
  "superseded",
  "archived"
] as const;

export type ACRLifecycle = (typeof ACR_LIFECYCLES)[number];

export const ACR_EVENT_TYPES = [
  "object.created",
  "object.validated",
  "object.activated",
  "object.completed",
  "object.rejected",
  "object.superseded",
  "object.archived",
  "relationship.added",
  "relationship.removed",
  "evidence.attached",
  "policy.attached"
] as const;

export type ACREventType = (typeof ACR_EVENT_TYPES)[number];

export const ACT_STATUSES = [
  "proposed",
  "validated",
  "committed",
  "published",
  "failed",
  "aborted",
  "compensated"
] as const;

export type ACTStatus = (typeof ACT_STATUSES)[number];

export interface ACRRelationship {
  type:
    | "depends_on"
    | "blocks"
    | "uses"
    | "references"
    | "implements"
    | "derived_from"
    | "generated_by"
    | "evaluates"
    | "supersedes";
  targetId: string;
  confidence?: number;
}

export interface ACREvidenceRef {
  sourceId: string;
  sourceType:
    | "user"
    | "memory"
    | "document"
    | "execution"
    | "experience"
    | "sensor"
    | "observation"
    | "decision";
  confidence?: number;
  spanRef?: string;
  hash?: string;
}

export interface ACRObject<TPayload = unknown> {
  id: string;
  type: ACRObjectType;
  schemaVersion: string;
  version: number;
  lifecycle: ACRLifecycle;
  createdAt: string;
  createdBy: string;
  goalId?: string;
  traceId: string;
  causalityId?: string;
  confidence: number;
  relationships: ACRRelationship[];
  evidence: ACREvidenceRef[];
  policies: string[];
  payload: TPayload;
}

export interface ACREvent<TPayload = unknown> {
  id: string;
  actId: string;
  type: ACREventType;
  occurredAt: string;
  actorId: string;
  objectId: string;
  objectVersion: number;
  traceId: string;
  causalityId?: string;
  payload: TPayload;
}

export interface ACTValidation {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface AtlasCognitiveTransaction {
  id: string;
  schemaVersion: string;
  status: ACTStatus;
  goalId?: string;
  traceId: string;
  causalityId?: string;
  createdAt: string;
  createdBy: string;
  intent: string;
  reason: string;
  preconditions: string[];
  policyRefs: string[];
  evidenceRefs: ACREvidenceRef[];
  events: ACREvent[];
  validation: ACTValidation;
  committedAt?: string;
  publishedAt?: string;
}
