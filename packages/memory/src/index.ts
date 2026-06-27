import type {
  DecisionOutcome,
  DecisionRequest,
  DecisionRiskSeverity
} from "@atlas-aios/decision-engine";

export type MemoryEventKind =
  | "conversation"
  | "decision"
  | "execution"
  | "approval"
  | "rejection"
  | "correction"
  | "meeting"
  | "failure";

export interface MemoryEvent {
  id: string;
  kind: MemoryEventKind;
  occurredAt: string;
  summary: string;
  sourceIds: string[];
}

export interface RecordDecisionOutcomeInput {
  id: string;
  occurredAt: string;
  decisionOutcome: DecisionOutcome;
  summary: string;
}

export interface MemoryDecisionRejection {
  id: string;
  reason: string;
  severity: DecisionRiskSeverity;
  evidenceRefs: string[];
  occurredAt: string;
}

export interface CreateDecisionRequestFromMemoryRejectionInput {
  originalRequest: DecisionRequest;
  memoryRejection: MemoryDecisionRejection;
}

export function recordDecisionOutcomeAsMemoryEvent(
  input: RecordDecisionOutcomeInput
): MemoryEvent {
  return {
    id: input.id,
    kind: "decision",
    occurredAt: input.occurredAt,
    summary: input.summary,
    sourceIds: uniqueRefs([
      input.decisionOutcome.requestId,
      ...input.decisionOutcome.evidenceRefs
    ])
  };
}

export function createDecisionRequestFromMemoryRejection(
  input: CreateDecisionRequestFromMemoryRejectionInput
): DecisionRequest {
  const { originalRequest, memoryRejection } = input;

  return {
    ...originalRequest,
    id: `${originalRequest.id}:memory_reconsideration:${memoryRejection.id}`,
    rationale: `${originalRequest.rationale} Memory rejected the prior decision: ${memoryRejection.reason}`,
    risks: [
      ...originalRequest.risks,
      {
        kind: "memory_rejection",
        severity: memoryRejection.severity,
        description: memoryRejection.reason,
        requiresRejection: true
      }
    ],
    evidenceRefs: uniqueRefs([
      ...originalRequest.evidenceRefs,
      ...memoryRejection.evidenceRefs
    ])
  };
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs)];
}
