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
  subjectIds?: string[];
  evidenceRefs?: string[];
  metadata?: Record<string, string>;
}

export interface RecordMemoryEventInput {
  id: string;
  kind: MemoryEventKind;
  occurredAt: string;
  summary: string;
  subjectIds: string[];
  sourceIds: string[];
  evidenceRefs: string[];
  metadata: Record<string, string>;
}

export interface ListMemoryEventsFilter {
  kinds?: MemoryEventKind[];
  subjectIds?: string[];
  sourceIds?: string[];
}

export interface MemoryStore {
  record(input: RecordMemoryEventInput): MemoryEvent;
  list(filter?: ListMemoryEventsFilter): MemoryEvent[];
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

export function createInMemoryMemoryStore(): MemoryStore {
  const events: MemoryEvent[] = [];

  return {
    record: (input) => {
      const event = cloneMemoryEvent({
        id: input.id,
        kind: input.kind,
        occurredAt: input.occurredAt,
        summary: input.summary,
        subjectIds: uniqueRefs(input.subjectIds),
        sourceIds: uniqueRefs(input.sourceIds),
        evidenceRefs: uniqueRefs(input.evidenceRefs),
        metadata: { ...input.metadata }
      });
      events.push(event);

      return cloneMemoryEvent(event);
    },
    list: (filter = {}) =>
      events.filter((event) => matchesMemoryFilter(event, filter)).map(cloneMemoryEvent)
  };
}

export function recordMemoryEvent(
  store: MemoryStore,
  input: RecordMemoryEventInput
): MemoryEvent {
  return store.record(input);
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

function matchesMemoryFilter(
  event: MemoryEvent,
  filter: ListMemoryEventsFilter
): boolean {
  return (
    matchesAny(event.kind, filter.kinds) &&
    overlaps(event.subjectIds ?? [], filter.subjectIds) &&
    overlaps(event.sourceIds, filter.sourceIds)
  );
}

function matchesAny<T>(value: T, allowedValues: T[] | undefined): boolean {
  return allowedValues === undefined || allowedValues.includes(value);
}

function overlaps(values: string[], filterValues: string[] | undefined): boolean {
  return (
    filterValues === undefined ||
    filterValues.some((filterValue) => values.includes(filterValue))
  );
}

function cloneMemoryEvent(event: MemoryEvent): MemoryEvent {
  return {
    ...event,
    sourceIds: [...event.sourceIds],
    ...(event.subjectIds === undefined ? {} : { subjectIds: [...event.subjectIds] }),
    ...(event.evidenceRefs === undefined
      ? {}
      : { evidenceRefs: [...event.evidenceRefs] }),
    ...(event.metadata === undefined ? {} : { metadata: { ...event.metadata } })
  };
}
