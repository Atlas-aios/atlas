import type { AtlasId, ISODateTime } from "./index.js";
import type { PillarId } from "./pillars.js";

export type AtlasEventSchemaVersion = "1.0";

export interface AtlasEventEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  id: AtlasId;
  type: string;
  topic?: string;
  schemaVersion: AtlasEventSchemaVersion;
  sourcePillar: PillarId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  traceId?: AtlasId;
  causalityId?: AtlasId;
  subjectRef?: AtlasId;
  dataRef?: AtlasId;
  payload: TPayload;
}

export interface AtlasEventEnvelopeInput<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  id: AtlasId;
  type: string;
  topic?: string;
  sourcePillar: PillarId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  traceId?: AtlasId;
  causalityId?: AtlasId;
  subjectRef?: AtlasId;
  dataRef?: AtlasId;
  payload: TPayload;
}

export function createAtlasEventEnvelope<TPayload extends Record<string, unknown>>(
  input: AtlasEventEnvelopeInput<TPayload>
): AtlasEventEnvelope<TPayload> {
  return {
    id: input.id,
    type: input.type,
    ...(input.topic === undefined ? {} : { topic: input.topic }),
    schemaVersion: "1.0",
    sourcePillar: input.sourcePillar,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
    ...(input.causalityId === undefined ? {} : { causalityId: input.causalityId }),
    ...(input.subjectRef === undefined ? {} : { subjectRef: input.subjectRef }),
    ...(input.dataRef === undefined ? {} : { dataRef: input.dataRef }),
    payload: input.payload
  };
}

export type AtlasAuditSeverity = "low" | "medium" | "high" | "critical";
export type AtlasAuditResult = "allowed" | "blocked" | "failed" | "completed";

export interface AuditEventInput {
  id: AtlasId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  actorId: AtlasId;
  action: string;
  result: AtlasAuditResult;
  severity: AtlasAuditSeverity;
  evidenceRefs: AtlasId[];
}

export interface AuditEventPayload extends Record<string, unknown> {
  actorId: AtlasId;
  action: string;
  result: AtlasAuditResult;
  severity: AtlasAuditSeverity;
  evidenceRefs: AtlasId[];
}

export type ApprovalStatus = "requested" | "approved" | "rejected" | "expired";

export interface ApprovalEventInput {
  id: AtlasId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  approvalId: AtlasId;
  subjectId: AtlasId;
  status: ApprovalStatus;
  requestedBy: AtlasId;
  reason: string;
}

export interface ApprovalEventPayload extends Record<string, unknown> {
  approvalId: AtlasId;
  subjectId: AtlasId;
  status: ApprovalStatus;
  requestedBy: AtlasId;
  reason: string;
}

export type ExecutionStatus =
  | "started"
  | "completed"
  | "failed"
  | "cancelled"
  | "compensated";

export interface ExecutionEventInput {
  id: AtlasId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  executionId: AtlasId;
  status: ExecutionStatus;
  capabilityId?: AtlasId;
  providerId?: AtlasId;
}

export interface ExecutionEventPayload extends Record<string, unknown> {
  executionId: AtlasId;
  status: ExecutionStatus;
  capabilityId?: AtlasId;
  providerId?: AtlasId;
}

export type MemoryEventType =
  | "conversation"
  | "decision"
  | "execution"
  | "approval"
  | "correction"
  | "meeting"
  | "failure";

export interface MemoryEventInput {
  id: AtlasId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  memoryId: AtlasId;
  memoryType: MemoryEventType;
  subjectId: AtlasId;
  summary: string;
  evidenceRefs: AtlasId[];
}

export interface MemoryEventPayload extends Record<string, unknown> {
  memoryId: AtlasId;
  memoryType: MemoryEventType;
  subjectId: AtlasId;
  summary: string;
  evidenceRefs: AtlasId[];
}

export function createAuditEvent(
  input: AuditEventInput
): AtlasEventEnvelope<AuditEventPayload> {
  return createAtlasEventEnvelope({
    id: input.id,
    type: "audit.recorded",
    sourcePillar: "learning-governance",
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      actorId: input.actorId,
      action: input.action,
      result: input.result,
      severity: input.severity,
      evidenceRefs: input.evidenceRefs
    }
  });
}

export function createApprovalEvent(
  input: ApprovalEventInput
): AtlasEventEnvelope<ApprovalEventPayload> {
  return createAtlasEventEnvelope({
    id: input.id,
    type: `approval.${input.status}`,
    sourcePillar: "learning-governance",
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      approvalId: input.approvalId,
      subjectId: input.subjectId,
      status: input.status,
      requestedBy: input.requestedBy,
      reason: input.reason
    }
  });
}

export function createExecutionEvent(
  input: ExecutionEventInput
): AtlasEventEnvelope<ExecutionEventPayload> {
  return createAtlasEventEnvelope({
    id: input.id,
    type: `execution.${input.status}`,
    sourcePillar: "cognitive-loop",
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      executionId: input.executionId,
      status: input.status,
      ...(input.capabilityId === undefined ? {} : { capabilityId: input.capabilityId }),
      ...(input.providerId === undefined ? {} : { providerId: input.providerId })
    }
  });
}

export function createMemoryEvent(
  input: MemoryEventInput
): AtlasEventEnvelope<MemoryEventPayload> {
  return createAtlasEventEnvelope({
    id: input.id,
    type: "memory.event.recorded",
    sourcePillar: "memory",
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      memoryId: input.memoryId,
      memoryType: input.memoryType,
      subjectId: input.subjectId,
      summary: input.summary,
      evidenceRefs: input.evidenceRefs
    }
  });
}
